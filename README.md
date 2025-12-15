# 🏷️ Labels Tools

A modern **web application for managing, editing, visualizing, and inferring labels for computer vision datasets**. Built with a focus on **YOLO format support** and **Gemini API integration**, Labels Tools helps you understand and improve your datasets before and during model training.

---

## ✨ Key Features

* 📦 **Import & manage label classes**
* ✏️ **Edit bounding boxes and labels visually**
* 👀 **Dataset exploration & visualization**
* 🤖 **Run inference using Gemini API**
* 📄 **YOLO format parsing & exporting**
* 🧩 **Modular React + TypeScript architecture**

---

## 🖼️ Use Cases

* Inspect dataset quality before training YOLO models
* Quickly fix incorrect or missing labels
* Visualize class distributions and annotations
* Compare ground-truth labels with Gemini inference results
* Manage datasets locally with a clean UI

---

## 🛠️ Tech Stack

* **Frontend**: React, TypeScript, Vite
* **UI**: Modern component-based design
* **AI Integration**: Google Gemini API
* **Data Format**: YOLO (txt-based annotations)

---

## 📋 Prerequisites

Make sure you have the following installed:

* **Node.js** ≥ 18
* **npm** or **yarn**
* A valid **Gemini API Key**

---

## 🚀 Getting Started

### 1️⃣ Install Dependencies

```bash
npm install
# or
yarn install
```

### 3️⃣ Run the App Locally

```bash
npm run dev
# or
yarn dev
```

---
### 🎬 Demo
![Labels Tools Demo](assets/demo.gif)

## 📁 Project Structure

```
├── components/        # React components (Dashboard, Editor, Modals, etc.)
├── services/          # API & Gemini integration logic
├── utils/             # Utility functions (YOLO parser, helpers)
├── types.ts           # Global TypeScript type definitions
├── constants.ts       # Application constants
├── App.tsx            # Main app entry point
├── main.tsx           # Vite bootstrap file
└── README.md
```

---

## 🧠 YOLO Format Support

* Parses standard YOLO `.txt` annotation files
* Supports:

  * `class_id x_center y_center width height`
* Visualizes bounding boxes directly on images
* Enables editing and re-exporting annotations

---

## 🤖 Inference & Model Integration

Labels Tools is designed to be **model-agnostic**.

### 🔌 Extensible Inference API

* Supports **Gemini API** out of the box
* Can be extended to work with **any object detection model**:

  * YOLO (v5–v9, Ultralytics)
  * Custom PyTorch / TensorFlow models
  * REST-based inference services

The inference layer is abstracted so you can **plug in your own model or API** and return predictions in a unified format.

### 🧪 Pseudo-Labeling Support

* Generate **pseudo-labels** from any OD model
* Compare pseudo-labels with ground truth
* Use results to:

  * Improve dataset quality
  * Bootstrap labeling for new datasets
  * Reduce manual annotation effort

This makes Labels Tools suitable not only for AI APIs, but also for **local, offline, or experimental models** to achieve the best possible labeling results.

---

## 🙌 Acknowledgements

* YOLO community
* Google Gemini API
* Open-source contributors

