
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
