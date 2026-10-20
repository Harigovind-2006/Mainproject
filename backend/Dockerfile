# 1. Use an official, lightweight Python 3.11 Debian image
FROM python:3.11-slim

# 2. Prevent Python from buffering logs or writing bytecode
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# 3. Set the working directory inside the container
WORKDIR /app

# 4. Leverage Docker cache: install dependencies first
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 5. Copy the backend application code and the ML model
COPY . .

# 6. Document the port the service listens on
EXPOSE 8000

# 7. Start the Uvicorn server bound to 0.0.0.0
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
