# 🚀 Dev Project Launcher

A powerful desktop application built with Electron and React that allows developers to manage and launch multiple types of projects (Django, Flask, Spring Boot, React, Angular, etc.) from a single interface.

---

## 📌 Features

- 🧠 Centralized project management
- ⚡ One-click project execution
- 🖥️ Supports multiple tech stacks:
  - Python (Django, Flask)
  - Java (Spring Boot)
  - JavaScript (React, Angular, Node.js)
- 🐍 Virtual environment activation support (Python)
- 🌱 Environment variable (.env) support
- 📂 Save and manage project configurations
- 📊 (Optional) Track project run time for analytics
- 💻 Works as a standalone desktop application

---

## 🛠️ Tech Stack

- **Frontend:** React.js
- **Backend (Main Process):** Electron.js
- **Packaging:** electron-builder
- **Languages Supported:** Python, Java, Node.js
- **Others:** Node.js, Shell Commands

---

## 📁 Project Structure

```
dev-prj-launcher/
├── src/
│   ├── main.js              # Electron main process
│   ├── preload.js           # Electron preload script
│   ├── App.jsx              # React main component
│   ├── components/          # React components
│   │   ├── ProjectCard.jsx
│   │   ├── ProjectForm.jsx
│   │   ├── ProjectList.jsx
│   │   └── ...
│   ├── services/            # Business logic
│   │   ├── projectService.js
│   │   ├── commandService.js
│   │   └── ...
│   ├── utils/               # Utility functions
│   └── index.css            # Global styles
├── assets/
│   ├── icon.png             # Application icon
│   └── icon.ico             # Windows icon
├── forge.config.js          # Electron Forge config
├── package.json
├── vite.main.config.mjs     # Vite config for main process
├── vite.renderer.config.mjs # Vite config for renderer process
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd dev-prj-launcher
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root directory (optional):

```env
# Example: Add custom paths or settings
CUSTOM_PATH=/path/to/custom/projects
```

### Project Configuration

Each project is configured with:

- **Name:** Display name in the UI
- **Type:** Technology stack (Django, Flask, Spring Boot, React, etc.)
- **Path:** Project directory location
- **Commands:** Startup commands for different environments
- **Environment Variables:** Optional `.env` file path
- **Virtual Environment:** Path to Python virtual environment (if applicable)

---

## 🏃 Running the Application

### Development Mode

Start the application in development mode with hot-reload:

```bash
npm run dev
# or
yarn dev
```

### Production Build

Build the application for production:

```bash
npm run make
# or
yarn make
```

This will create installers in the `out/` directory:

- `DevProjectLauncherSetup.exe` (Windows)
- `.dmg` (macOS)
- `.deb` (Linux)

### Packaging

To package for specific platforms:

```bash
npm run make -- --platform=win32
npm run make -- --platform=darwin
npm run make -- --platform=linux
```

---

## 🛠️ Development

### Adding a New Project Type

1. Update `src/services/projectService.js` with the new project type
2. Add appropriate startup commands
3. Update `src/components/ProjectForm.jsx` to support the new type
4. Add relevant icons to `assets/` if needed

### Running Tests

```bash
npm test
# or
yarn test
```

### Linting

```bash
npm run lint
# or
yarn lint
```

---

## 🧩 Supported Project Types

### Python
- **Django:** `python manage.py runserver`
- **Flask:** `flask run`
- **FastAPI:** `uvicorn main:app --reload`

### Java
- **Spring Boot:** `./mvnw spring-boot:run` or `./gradlew bootRun`

### JavaScript
- **React:** `npm run dev`
- **Angular:** `ng serve`
- **Vue:** `npm run dev`
- **Node.js:** `node server.js`

### Shell
- Custom shell commands
- Script execution

---

## 📊 Analytics (Optional)

The application can track project run times and generate analytics reports. Configure in `src/services/analyticsService.js`.

---

## 📝 License

[MIT License](LICENSE)

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📞 Support

For issues or questions, please open an issue on the repository.

---

## 📄 Changelog

See [CHANGELOG.md](CHANGELOG.md) for recent changes.

---

## 👥 Team

- Midhun V S
- Claude AI

---

## 🙏 Acknowledgments

- Electron.js
- React.js
- Vite
- electron-builder
- [Other libraries and tools]

---

## 🔗 Useful Links

- [Electron Documentation](https://www.electronjs.org/)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [electron-builder Documentation](https://www.electron.build/)

---

## 📝 Notes

- This application is designed to streamline developer workflows by providing a centralized interface for managing and launching projects.
- The project structure is modular, making it easy to extend and maintain.
- All project configurations are stored in a structured format, allowing for easy backup and migration.

---

**Happy Coding! 🚀**
