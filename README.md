![StorySpark AI Banner](https://raw.githubusercontent.com/Gbomzy/story-spark-ai/main/asset/storyspark-ai-banner.png)
# 🎬 StorySpark AI

**StorySpark AI** is an AI-powered platform that transforms simple story ideas into complete animated movies for children.

Built using Alibaba Cloud AI technologies, StorySpark AI automates the entire creative workflow—from story generation to storyboard creation, image generation, voice narration, cinematic video generation, movie composition, and publishing.

---

## 🚀 Features

- ✍️ AI Story Generation
- 📖 Story Bible & World Building
- 👥 Character Memory & Consistency
- 🎞️ Automatic Storyboard Generation
- 🖼️ AI Image Generation
- 🎙️ AI Voice Narration
- 🎥 AI Video Generation
- 🎬 Movie Composer
- 📦 Render Queue & Background Processing
- 💳 Credit & Billing System
- 📊 Admin Dashboard
- 📢 Publishing Workflow
- 🔔 Notifications & Progress Tracking

---

## 🧠 AI Workflow

1. Create a story
2. Generate characters
3. Build the Story Bible
4. Generate storyboard scenes
5. Create cinematic images
6. Generate expressive narration
7. Generate AI videos
8. Compose the final movie
9. Publish the completed movie

---

## 🏗️ Technology Stack

### Frontend
- React
- TypeScript
- TanStack Router
- Tailwind CSS
- Vite

### Backend
- Supabase
- PostgreSQL
- Edge Functions
- Row Level Security (RLS)

### AI Services
- Alibaba Cloud Qwen
- Alibaba Cloud Wan

---

## 🎯 Problem

Creating high-quality animated children's stories traditionally requires writers, illustrators, voice actors, editors, and animators.

StorySpark AI dramatically reduces this complexity by enabling creators to generate complete animated stories from a single idea.

---

## 💡 Solution

StorySpark AI combines large language models, image generation, voice synthesis, and AI video generation into one seamless production pipeline.

The platform allows creators to generate educational and entertaining children's movies in minutes instead of weeks.

---

## 🔒 Production Status

- ✅ Zero TypeScript Errors
- ✅ Production Build Passing
- ✅ Multi-stage AI Pipeline
- ✅ Render Queue
- ✅ Credit Management
- ✅ Authentication
- ✅ Project Management
- ✅ Admin Dashboard

---
## 🏗️ StorySpark AI Enterprise Architecture

flowchart TB

    User([User])

    Frontend["StorySpark AI
    React + TypeScript"]

    Auth["Authentication"]

    Supabase["Supabase
    Database + Storage"]

    Story["Story Engine"]

    Memory["Character Memory"]

    Storyboard["Storyboard Engine"]

    Images["Image Generation"]

    Voice["Voice Narration"]

    Video["Video Generation"]

    Qwen["Alibaba Cloud
    Qwen API"]

    Wan["Alibaba Cloud
    Wan Video API"]

    Movie["Movie Composer"]

    Export["Export
    MP4 / Download"]

    User --> Frontend

    Frontend --> Auth
    Frontend --> Story
    Frontend --> Storyboard
    Frontend --> Memory
    Frontend --> Images
    Frontend --> Voice
    Frontend --> Video

    Auth --> Supabase

    Story --> Qwen
    Storyboard --> Qwen
    Memory --> Qwen
    Images --> Qwen
    Voice --> Qwen

    Video --> Wan

    Qwen --> Movie
    Wan --> Movie

    Movie --> Export

    Export --> User

    Supabase --> Frontend

## 🚀 AI Workflow

User Idea
    │
    ▼
Story Generation (Qwen)
    │
    ▼
Character Memory
    │
    ▼
Storyboard Generation
    │
    ▼
Image Generation
    │
    ▼
Voice Narration
    │
    ▼
Video Generation (Wan)
    │
    ▼
Movie Composition
    │
    ▼
Final Animated Movie

---

## 📈 Future Roadmap

- Collaborative projects
- Multi-language movie generation
- Real-time character editing
- Team workspaces
- AI music generation
- Cloud rendering improvements

---

## 👨‍💻 Developer

Developed by **Thomas Agbona**

---

## 🏆 Hackathon

Prepared for the **Alibaba Cloud Global AI Hackathon**.

---

## 📄 License

This project is intended for demonstration and hackathon purposes.
