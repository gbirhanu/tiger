# Tiger: AI-Enhanced Productivity Suite

**Unleash your productivity - as effective as a tiger.**

![Tiger Logo](/client/public/assets/tiger_logo.png)

## Overview

Tiger is a modern productivity platform that integrates task management, time tracking, calendar integration, and AI-powered note-taking into a seamless workflow. Designed for professionals who need to maintain peak productivity while managing complex projects and tasks.

## Key Features

- **🎯 Task Management**: Create, organize, and track tasks with powerful subtask functionality
- **⏱️ Time Tracking**: Monitor productivity and focus time with built-in time tracking
- **📅 Calendar Integration**: Seamlessly integrate with your existing calendar for appointments and events
- **📝 Rich Note Taking**: Capture ideas with markdown support and AI-enhanced editing
- **✨ AI Assistance**: Generate content and get smart suggestions powered by Gemini AI
- **🌓 Dark/Light Mode**: Full theme support for comfortable use in any environment
- **📱 Responsive Design**: Works seamlessly across desktop and mobile devices

## Screenshots

<div align="center">
  <img src="/client/public/assets/light_preview.png" alt="Tiger Light Mode" width="45%">
  <img src="/client/public/assets/dark_preview.png" alt="Tiger Dark Mode" width="45%">
</div>

## Tech Stack

- **Frontend**: React, React Router, TailwindCSS, Shadcn UI
- **Backend**: Express.js, TypeScript
- **Database**: SQLite with Drizzle ORM
- **Authentication**: Custom auth system with JWT
- **AI Integration**: Google Gemini AI
- **State Management**: React Query

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Installation

1. Clone the repository

   ```bash
   git clone https://github.com/yourusername/tiger.git
   cd tiger
   ```

2. Install dependencies

   ```bash
   npm install
   ```

3. Configure environment variables

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Set up the database

   ```bash
   npm run db:push
   ```

5. Start the development server

   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. **Register/Login**: Create an account or login to access the dashboard
2. **Create Tasks**: Start organizing your work by creating tasks and subtasks
3. **Track Time**: Use the built-in timer to track time spent on tasks
4. **Take Notes**: Create rich markdown notes with AI assistance
5. **Connect Calendar**: Integrate with your existing calendar for comprehensive scheduling

## Development

### Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build for production
- `npm run start` - Run the production server
- `npm run db:push` - Push schema changes to the database
- `npm run db:generate` - Generate database migrations

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For questions or support, please contact <support@tigerapp.com>
