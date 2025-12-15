import { LabelClass } from "./types";

export const LABEL_COLORS = [
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#22c55e', // Green
  '#eab308', // Yellow
  '#a855f7', // Purple
  '#ec4899', // Pink
  '#f97316', // Orange
  '#06b6d4', // Cyan
  '#14b8a6', // Teal
  '#8b5cf6', // Violet
];

export const DEFAULT_CLASSES: LabelClass[] = [
  { id: 0, name: 'grdg' },
  { id: 1, name: 'car' },
  { id: 2, name: 'dog' },
  { id: 3, name: 'cat' },
  { id: 4, name: 'chair' },
  { id: 5, name: 'bottle' }
];

export const MOCK_PYTHON_SCRIPT = `[
  {
    "label": "person",
    "xmin": 0.25,
    "ymin": 0.1,
    "xmax": 0.6,
    "ymax": 0.9,
    "score": 0.98
  },
  {
    "label": "car",
    "xmin": 0.65,
    "ymin": 0.4,
    "xmax": 0.95,
    "ymax": 0.8,
    "score": 0.85
  }
]`;

export const PYODIDE_TEMPLATE = `
import numpy as np
import base64
import json

# 'image_data' is provided globally as a base64 string.
# In a real environment, you might decode it:
# img_bytes = base64.b64decode(image_data)

# Perform your detection logic here.
# For this demo, we just return dummy bounding boxes.

# The 'results' variable MUST be a list of dictionaries.
# Coordinates must be normalized 0-1 (xmin, ymin, xmax, ymax)
results = [
    {
        "label": "demo_object",
        "xmin": 0.2, 
        "ymin": 0.3, 
        "xmax": 0.5, 
        "ymax": 0.6,
        "score": 0.95
    }
]
`;

export const FASTAPI_TEMPLATE = `
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import base64
import json

app = FastAPI()

# Enable CORS for browser access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ImageRequest(BaseModel):
    image: str # Base64 encoded string

@app.post("/predict")
async def predict(req: ImageRequest):
    try:
        # 1. Decode image if needed
        # image_data = base64.b64decode(req.image)
        
        # 2. Run your model inference here
        # ...

        # 3. Return results in this specific JSON format
        # Coordinates must be normalized 0-1 (xmin, ymin, xmax, ymax)
        return [
            {
                "label": "demo_object",
                "xmin": 0.1,
                "ymin": 0.1,
                "xmax": 0.4,
                "ymax": 0.4,
                "score": 0.95
            }
        ]
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    print("Starting server on http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
`;