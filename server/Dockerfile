FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1

WORKDIR /app
RUN pip install --no-cache-dir websockets==16.0

COPY ws_server.py /app/ws_server.py

EXPOSE 8765
CMD ["python", "/app/ws_server.py"]
