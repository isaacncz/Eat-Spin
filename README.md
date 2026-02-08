# 🍽️ Eat-Spin

> A fun and interactive food roulette app to help you decide what and where to eat!

---

## 🚀 Overview

Eat-Spin is a modern web app built with **React**, **TypeScript**, and **Vite**. It helps users break the cycle of indecision by spinning a roulette wheel to pick a restaurant or food category. Perfect for groups, families, or anyone who can't decide what to eat!

---

## ✨ Features

- 🎡 Roulette wheel for random food/restaurant selection
- 📍 Location-based suggestions (with permission)
- 🍽️ Food category filtering
- ⏰ Meal time indicator
- 🔄 Spin limit warning
- 💎 Subscription modal for premium features
- 📱 Mobile-friendly UI
- ⚡ Fast, modern, and responsive

---

## 🛠️ Tech Stack

- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [ESLint](https://eslint.org/)

---

## 📦 Getting Started

1. **Clone the repo:**
   ```sh
   git clone https://github.com/isaacncz/Eat-Spin.git
   cd Eat-Spin/app
   ```

2. **Install dependencies:**
   ```sh
   npm install
   ```

3. **Start the development server:**
   ```sh
   npm run dev
   ```

4. **Open in browser:**
   Visit [http://localhost:5173](http://localhost:5173)

---

## 📁 Project Structure

```
app/
src/
  components/ # UI components
  data/       # Restaurant/food data
  hooks/      # Custom React hooks
  lib/        # Utility functions
  sections/   # Page sections
  types/      # TypeScript types
```

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

---

## 📜 License

MIT

---

## 🙏 Credits

Made with ❤️ by [isaacncz](https://github.com/isaacncz)

---

## Firebase Group Spin Setup

Group Spin now uses Firebase Realtime Database + Anonymous Auth for cross-browser/device rooms.

1. Copy `.env.example` to `.env` and fill values.
2. In Firebase Console:
   - Enable `Authentication > Sign-in method > Anonymous`.
   - Create a Realtime Database instance.
3. In `Realtime Database > Rules`, paste `docs/firebase-rtdb-rules.json`.
4. In Netlify project settings, add:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_DATABASE_URL`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_APP_ID`
