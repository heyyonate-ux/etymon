# Etymon - Daily Word Origins Puzzle

**Live Demo:** [etymon-game.netlify.app](https://etymon-game.netlify.app)

A daily word puzzle game that challenges players to guess words based on their etymological roots. Think Wordle meets linguistics - learn the origins of words while testing your vocabulary!

![Etymon Game Screenshot](https://img.shields.io/badge/Status-Live-success)
![Platform](https://img.shields.io/badge/Platform-Web%20%7C%20Mobile-blue)

## 🎮 How to Play

**Objective:** Guess the target word using clues about its Greek or Latin roots.

**Game Structure:**
- **5 Rounds Total:** 4 speed rounds + 1 final challenge
- **Speed Rounds:** Letters reveal automatically every 12 seconds - guess quickly for bonus points
- **Final Challenge:** No auto-reveal - place each letter in its exact position for maximum score

**Scoring:**
- Faster guesses = higher scores
- Fewer wrong guesses = bonus points
- Complete all 5 rounds to see your etymological expertise level

**Example:**
```
Clue: "Greek roots meaning: far, to look"
Word: T E L E S C O P E
```

## ✨ Features

### Game Mechanics
- **Daily Puzzles:** New set of 5 words generated daily using GPT-4
- **Progressive Difficulty:** Words increase in complexity from Novitiate → Etymologus Maximus
- **Real-time Scoring:** Points calculated based on speed and accuracy
- **Letter Tracking:** Visual feedback showing correct (green) and incorrect (red) guesses

### Educational Value
- **Etymology Learning:** Each word includes detailed origin stories
- **Root Breakdowns:** Greek and Latin root meanings explained
- **Historical Context:** Learn when words entered the English language
- **Definitions:** Full word definitions provided

### User Experience
- **Mobile-First Design:** Optimized for touch screens and small displays
- **Responsive Layout:** Works seamlessly on desktop, tablet, and mobile
- **Smooth Animations:** Polished transitions and visual feedback
- **Share Results:** Share your score with emoji-based performance indicators

### Technical Highlights
- **PWA Ready:** Works offline after first load
- **Performance Optimized:** Fast loading, minimal dependencies
- **Accessible:** Keyboard navigation, screen reader friendly
- **Cross-Platform:** iOS, Android, Desktop browsers

## 🛠️ Technical Stack

### Frontend
- **HTML5/CSS3** - Semantic markup, modern styling
- **Vanilla JavaScript** - No frameworks, pure ES6+
- **CSS Variables** - Theming system with parchment aesthetic
- **Responsive Design** - Mobile-first with breakpoint at 640px

### Backend
- **Netlify Functions** - Serverless API endpoints
- **OpenAI GPT-4** - Daily puzzle generation
- **Node.js** - Runtime for serverless functions

### Deployment
- **Netlify** - Hosting and continuous deployment
- **Git** - Version control
- **GitHub** - Repository hosting

## 📱 Mobile Optimization

Special attention paid to mobile UX:
- **Letter Tracker** instead of on-screen keyboard (saves 40-50% screen space)
- **Auto-scroll** to keep important content visible when keyboard opens
- **Touch-optimized** buttons and interactive elements
- **Compact UI** with smart spacing to maximize gameplay area

## 🎨 Design Philosophy

**Visual Identity:**
- **Parchment aesthetic** - Warm, scholarly feel appropriate for etymology
- **Color palette** - Earth tones (browns, beiges) with accent colors
- **Typography** - Crimson Pro (serif) for headers, DM Sans for body
- **Clarity over decoration** - Minimal UI that highlights the words

**User-Centered Decisions:**
- Removed on-screen keyboard in favor of native device keyboard
- Letter tracker shows all attempts at a glance
- Clear visual hierarchy (word → clue → stats)
- Progressive disclosure (definitions collapsible)

## 🚀 Setup & Development

### Prerequisites
```bash
node >= 14.0.0
npm >= 6.0.0
```

### Installation
```bash
# Clone repository
git clone https://github.com/yourusername/etymon-game.git
cd etymon-game

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your OPENAI_API_KEY to .env
```

### Development
```bash
# Run local development server
netlify dev

# Visit http://localhost:8888
```

### Deployment
```bash
# Deploy to Netlify
netlify deploy --prod

# Or push to main branch for automatic deployment
git push origin main
```

## 📊 Performance Metrics

- **First Contentful Paint:** < 1s
- **Time to Interactive:** < 2s
- **Lighthouse Score:** 95+ (Performance, Accessibility, Best Practices)
- **Bundle Size:** < 50KB (no external dependencies)

## 🔮 Future Enhancements

**Planned Features:**
- [ ] User accounts and progress tracking
- [ ] Leaderboards (daily, weekly, all-time)
- [ ] Practice mode with unlimited puzzles
- [ ] Difficulty selection
- [ ] Multiple language support
- [ ] Word collections by theme (science, medicine, philosophy)
- [ ] Hints system
- [ ] Streak tracking

**Technical Improvements:**
- [ ] Service Worker for true offline support
- [ ] Database for user progress (Firebase/Supabase)
- [ ] Analytics integration
- [ ] A/B testing framework
- [ ] Custom domain

## 📝 Project Structure

```
etymon-game/
├── public/
│   ├── index.html          # Main game interface
│   ├── manifest.json       # PWA manifest
│   └── icons/              # App icons
├── netlify/
│   └── functions/
│       └── generate-puzzles.js  # Daily puzzle generation
├── .env                    # Environment variables
├── netlify.toml           # Netlify configuration
├── package.json           # Dependencies
└── README.md              # This file
```

## 🤝 Contributing

This is a personal project, but suggestions and feedback are welcome!

## 📄 License

© 2026 - Personal Project

## 🙏 Acknowledgments

- **OpenAI GPT-4** - Puzzle generation
- **Netlify** - Hosting and serverless functions
- **Google Fonts** - Crimson Pro and DM Sans typefaces
- **Etymology Online** - Inspiration for educational content

---

**Built with care by Nate Miller**

