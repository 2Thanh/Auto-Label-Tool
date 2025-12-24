from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ultralytics import YOLO
import base64
import cv2
import numpy as np

# --------------------
# Load YOLO model once
# --------------------
model = YOLO("yolov8n.pt")  # or your custom model: best.pt

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ImageRequest(BaseModel):
    image: str  # Base64 encoded image

@app.post("/predict")
async def predict(req: ImageRequest):
    try:
        # --------------------
        # Decode Base64 image
        # --------------------
        image_bytes = base64.b64decode(req.image)
        np_arr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if img is None:
            raise ValueError("Invalid image")

        h, w = img.shape[:2]

        # --------------------
        # YOLO inference
        # --------------------
        results = model(img, verbose=False)[0]

        detections = []

        if results.boxes is not None:
            boxes = results.boxes.xyxy.cpu().numpy()
            scores = results.boxes.conf.cpu().numpy()
            classes = results.boxes.cls.cpu().numpy().astype(int)

            for box, score, cls_id in zip(boxes, scores, classes):
                x1, y1, x2, y2 = box

                detections.append({
                    "label": model.names[cls_id],
                    "xmin": float(x1 / w),
                    "ymin": float(y1 / h),
                    "xmax": float(x2 / w),
                    "ymax": float(y2 / h),
                    "score": float(score)
                })

        return detections

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --------------------
# Run server
# --------------------
if __name__ == "__main__":
    import uvicorn
    print("🚀 Server running at http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
