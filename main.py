# Save this as main.py inside the "No-Code ML Pipeline Builder" folder
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
import logging
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
from io import BytesIO
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, MinMaxScaler
from sklearn.linear_model import LogisticRegression, LinearRegression, Ridge
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.svm import SVR
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix, mean_squared_error, mean_absolute_error, r2_score
from sklearn.utils.multiclass import unique_labels
from typing import Optional, List
import requests
import json
import uvicorn

app = FastAPI()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Enable connection from React Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ASGI app for deployment
asgi_app = app

# In-memory storage
db = {"df": None}

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    contents = await file.read()
    fname = (file.filename or "").lower()
    if fname.endswith('.csv'):
        df = pd.read_csv(BytesIO(contents))
    elif fname.endswith('.xls') or fname.endswith('.xlsx'):
        df = pd.read_excel(BytesIO(contents))
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    # Normalize and store DataFrame for this session (in-memory)
    df = df.fillna(0)
    db["df"] = df

    return {
        "rows": df.shape[0],
        "columns": df.columns.tolist(),
        "column_types": {c: str(df[c].dtype) for c in df.columns},
        "columns_unique_counts": {c: int(df[c].nunique()) for c in df.columns}
    }


@app.get("/target_stats")
async def target_stats(col: str):
    """Return basic stats for a column: dtype, unique count and top value counts.
    Useful for the frontend to show class distribution or detect many-class problems.
    """
    df = db.get("df")
    if df is None:
        raise HTTPException(status_code=400, detail="No dataset uploaded. Please POST /upload first.")
    if col not in df.columns:
        raise HTTPException(status_code=400, detail=f"Column '{col}' not found in dataset")

    s = df[col].fillna(0)
    dtype = str(s.dtype)
    n_unique = int(s.nunique())
    # top N counts (convert values to strings to ensure JSON serialization)
    top_counts = []
    for v, cnt in s.value_counts().head(50).items():
        top_counts.append({"value": str(v), "count": int(cnt)})

    return {"column": col, "dtype": dtype, "n_unique": n_unique, "top": top_counts}


@app.post("/check_urls")
async def check_urls(urls: List[str]):
    """Check reachability of a list of URLs. Returns list of {url, ok, status}.
    Uses a HEAD request first, falls back to GET on some servers. Timeouts kept small.
    """
    results = []
    for u in urls:
        try:
            # try HEAD first
            resp = requests.head(u, allow_redirects=True, timeout=4)
            status = resp.status_code
            ok = 200 <= status < 400
        except Exception:
            # fallback to GET
            try:
                resp = requests.get(u, allow_redirects=True, timeout=6)
                status = resp.status_code
                ok = 200 <= status < 400
            except Exception:
                status = None
                ok = False
        results.append({"url": str(u), "ok": bool(ok), "status": status})
    return {"checked": len(results), "results": results, "reachable": sum(1 for r in results if r["ok"])}

@app.post("/train")
async def train_model(
    target: str = Form(...),
    features: str = Form(...),
    model_type: str = Form(...),
    split_ratio: float = Form(0.2),
    preprocess_standardize: str = Form("[]"),
    preprocess_normalize: str = Form("[]"),
    max_depth: Optional[int] = Form(None),
    epochs: int = Form(100),
    task_type: str = Form("auto"),
    allowed_target_values: str = Form("[]"),
):
    df = db.get("df")
    if df is None:
        raise HTTPException(status_code=400, detail="No dataset uploaded. Please POST /upload first.")

    # Log incoming parameters for debugging
    logger.info("/train called with target=%s, features=%s, model_type=%s, task_type=%s, split_ratio=%s, epochs=%s, max_depth=%s",
                target, features, model_type, task_type, split_ratio, epochs, max_depth)

    try:
        feat_list = json.loads(features)
        if not isinstance(feat_list, list):
            raise ValueError("features must be a JSON list")
    except Exception as e:
        logger.info("Failed parsing features: %s -- raw: %s", e, features)
        raise HTTPException(status_code=400, detail=f"Invalid features payload; must be JSON list of column names. Error: {e}")

    if not isinstance(feat_list, list) or len(feat_list) == 0:
        raise HTTPException(status_code=400, detail="Feature list is empty")

    if target not in df.columns:
        raise HTTPException(status_code=400, detail="Target column not found in dataset")

    missing = [c for c in feat_list if c not in df.columns]
    if missing:
        raise HTTPException(status_code=400, detail=f"Feature columns not found: {missing}")
    # Prepare X/y (do not one-hot encode yet for simplicity; only numeric preprocessing allowed per UI)
    X = df[feat_list].copy()
    y = df[target].copy()

    # If frontend provided an allowed list of target values, filter dataset accordingly (useful for URL validation)
    try:
        allowed_vals = json.loads(allowed_target_values)
        if isinstance(allowed_vals, list) and len(allowed_vals) > 0:
            # convert to str for robust comparison
            df_str = df.copy()
            df_str[target] = df_str[target].astype(str)
            allowed_set = set([str(v) for v in allowed_vals])
            mask = df_str[target].isin(allowed_set)
            X = df_str.loc[mask, feat_list].copy()
            y = df_str.loc[mask, target].copy()
    except Exception:
        pass

    # Auto-detect task type if not specified
    if task_type == "auto":
        # If target is numeric with many unique values or is float, treat as regression
        if pd.api.types.is_numeric_dtype(y) and (str(y.dtype).startswith("float") or y.nunique() > 20):
            task_type = "regression"
        else:
            task_type = "classification"
        logger.info("Auto-detected task_type: %s", task_type)

    # Validate target for selected task type
    if task_type == "classification":
        if y.nunique() < 2:
            raise HTTPException(status_code=400, detail="Classification: target must have at least 2 distinct classes.")
    elif task_type == "regression":
        if not pd.api.types.is_numeric_dtype(y):
            raise HTTPException(status_code=400, detail="Regression: target must be numeric.")
    else:
        raise HTTPException(status_code=400, detail="Unknown task_type. Choose 'auto', 'classification', or 'regression'.")

    # Parse preprocessing lists
    try:
        std_cols = json.loads(preprocess_standardize)
        if not isinstance(std_cols, list):
            std_cols = []
    except Exception as e:
        logger.info("Failed parsing preprocess_standardize: %s -- raw: %s", e, preprocess_standardize)
        std_cols = []
    try:
        norm_cols = json.loads(preprocess_normalize)
        if not isinstance(norm_cols, list):
            norm_cols = []
    except Exception as e:
        logger.info("Failed parsing preprocess_normalize: %s -- raw: %s", e, preprocess_normalize)
        norm_cols = []

    # normalize model_type to canonical values
    mt = (model_type or "").lower()
    if mt in ("decision_tree", "tree"):
        mt = "decision_tree"
    elif mt in ("random_forest", "randomforest", "forest"):
        mt = "random_forest"
    elif mt == "logistic":
        mt = "logistic"
    else:
        logger.info("Unknown model_type received: %s", model_type)
        raise HTTPException(status_code=400, detail="Unknown model_type. Choose 'logistic', 'decision_tree', or 'random_forest'.")

    # ensure split_ratio is float and within sensible bounds
    try:
        split_ratio = float(split_ratio)
        if split_ratio <= 0 or split_ratio >= 0.9:
            raise ValueError("split_ratio out of bounds")
    except Exception as e:
        logger.info("Invalid split_ratio: %s", e)
        raise HTTPException(status_code=400, detail=f"Invalid split_ratio value: {split_ratio}. Provide a decimal between 0.05 and 0.5.")

    # Validate selections
    for c in std_cols + norm_cols:
        if c not in feat_list:
            raise HTTPException(status_code=400, detail=f"Preprocessing column '{c}' is not in selected features")
    overlap = set(std_cols).intersection(set(norm_cols))
    if overlap:
        raise HTTPException(status_code=400, detail=f"Columns selected for both standardization and normalization: {list(overlap)}. Choose one per column.")

    # Perform train/test split (use stratify when possible)
    try:
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=split_ratio, random_state=42, stratify=y)
    except Exception:
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=split_ratio, random_state=42)

    # Basic sanity checks
    if X_train.shape[0] == 0 or X_test.shape[0] == 0:
        raise HTTPException(status_code=400, detail="Not enough data after train/test split. Provide more rows or adjust split ratio.")

    # Apply preprocessing: fit on train, transform both
    if len(std_cols) > 0:
        scaler = StandardScaler()
        try:
            scaler.fit(X_train[std_cols])
            X_train.loc[:, std_cols] = scaler.transform(X_train[std_cols])
            X_test.loc[:, std_cols] = scaler.transform(X_test[std_cols])
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Standardization failed: {e}")

    if len(norm_cols) > 0:
        mn = MinMaxScaler()
        try:
            mn.fit(X_train[norm_cols])
            X_train.loc[:, norm_cols] = mn.transform(X_train[norm_cols])
            X_test.loc[:, norm_cols] = mn.transform(X_test[norm_cols])
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Normalization failed: {e}")

    # For classifiers, encode categorical features with get_dummies now
    X_train_enc = pd.get_dummies(X_train)
    X_test_enc = pd.get_dummies(X_test)

    # Ensure train and test have same columns
    missing_cols = set(X_train_enc.columns) - set(X_test_enc.columns)
    for c in missing_cols:
        X_test_enc[c] = 0
    extra_cols = set(X_test_enc.columns) - set(X_train_enc.columns)
    for c in extra_cols:
        X_train_enc[c] = 0
    # Reorder columns
    X_test_enc = X_test_enc[X_train_enc.columns]

    # Instantiate model based on task type
    try:
        if task_type == "classification":
            if mt == "logistic":
                clf = LogisticRegression(max_iter=max(200, int(epochs)))
            elif mt == "decision_tree":
                clf = DecisionTreeClassifier(max_depth=max_depth)
            elif mt == "random_forest":
                clf = RandomForestClassifier(n_estimators=max(10, int(epochs)), random_state=42)
            else:
                logger.info("Model type normalized to unexpected value: %s", mt)
                raise HTTPException(status_code=400, detail="Unknown model_type after normalization.")
        elif task_type == "regression":
            if mt == "logistic":
                clf = LinearRegression()
            elif mt == "decision_tree":
                clf = DecisionTreeRegressor(max_depth=max_depth, random_state=42)
            elif mt == "random_forest":
                clf = RandomForestRegressor(n_estimators=max(10, int(epochs)), random_state=42)
            else:
                logger.info("Model type normalized to unexpected value: %s", mt)
                raise HTTPException(status_code=400, detail="Unknown model_type after normalization.")
        else:
            raise HTTPException(status_code=400, detail="Unknown task_type.")

        clf.fit(X_train_enc, y_train)
        preds = clf.predict(X_test_enc)

        # Compute metrics based on task type
        if task_type == "classification":
            acc = float(accuracy_score(y_test, preds))
            prec = float(precision_score(y_test, preds, average='weighted', zero_division=0))
            rec = float(recall_score(y_test, preds, average='weighted', zero_division=0))
            f1 = float(f1_score(y_test, preds, average='weighted', zero_division=0))
            cm = confusion_matrix(y_test, preds)
            # Use sklearn's unique_labels to ensure rows/columns align with the confusion matrix
            labs = unique_labels(y_test, preds)
            labels = list(map(str, labs))
            cm = cm.tolist()
            # If there are too many classes, indicate that in the response so the frontend can decide how to render
            too_many_classes = len(labels) > 40

            return {
                "task_type": task_type,
                "accuracy": acc,
                "precision": prec,
                "recall": rec,
                "f1": f1,
                "confusion_matrix": cm,
                "labels": labels,
                "too_many_classes": too_many_classes,
                "train_size": int(X_train.shape[0]),
                "test_size": int(X_test.shape[0]),
                "split_ratio": split_ratio,
                "preprocessing": {"standardize": std_cols, "normalize": norm_cols},
                "details": f"Trained {model_type}"
            }
        else:  # regression
            mse = float(mean_squared_error(y_test, preds))
            mae = float(mean_absolute_error(y_test, preds))
            rmse = float(np.sqrt(mse))
            r2 = float(r2_score(y_test, preds))

            return {
                "task_type": task_type,
                "mse": mse,
                "mae": mae,
                "rmse": rmse,
                "r2": r2,
                "train_size": int(X_train.shape[0]),
                "test_size": int(X_test.shape[0]),
                "split_ratio": split_ratio,
                "preprocessing": {"standardize": std_cols, "normalize": norm_cols},
                "details": f"Trained {model_type}"
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training failed: {e}")

# This allows specific start command
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)