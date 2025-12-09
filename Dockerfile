FROM python:3.12-slim

WORKDIR /app

# Install system deps required for some scientific packages
RUN apt-get update && apt-get install -y build-essential gcc libgomp1 && rm -rf /var/lib/apt/lists/*

# Copy project files
COPY . /app

# Install Python dependencies
COPY requirements.txt /app/requirements.txt
RUN python -m pip install --upgrade pip setuptools wheel
RUN pip install --no-cache-dir -r /app/requirements.txt

# Expose port for uvicorn
EXPOSE 8000

# Default command
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
