# Planning Joker

A small realtime scrum planning poker app. The frontend is a static Vite app that can ship on GitHub Pages, and PartyKit hosts the temporary realtime room logic.

## MVP

- Create a room and share its link.
- Join with a display name.
- Pick estimate cards.
- See who has voted without seeing hidden votes.
- Reveal all votes together.
- Reset for the next story.
- Copy the final result.

## Local Setup

Install dependencies:

```bash
npm install
```

Run the PartyKit room server in one terminal:

```bash
npm run dev:party
```

Run the frontend in another terminal:

```bash
npm run dev:frontend
```

The frontend defaults to `localhost:1999` for PartyKit in development. For a deployed PartyKit host, set:

```bash
VITE_PARTYKIT_HOST=your-project.username.partykit.dev
```

## Deploy

Deploy PartyKit manually first:

```bash
npx partykit deploy --cwd partykit
```

Build the frontend for GitHub Pages:

```bash
npm run build
```

Production builds read `VITE_PARTYKIT_HOST` from the environment. The GitHub Pages
workflow expects that value to be configured as a repository variable.

The Vite base path defaults to relative assets so the build works well on GitHub Pages project sites. Override it if needed:

```bash
VITE_BASE_PATH=/planning-joker/ npm run build
```

## GitHub Pages

The repository includes a GitHub Actions workflow at `.github/workflows/deploy-pages.yml`.

On every push to `main`, GitHub will:

- install dependencies
- run TypeScript checks
- build the frontend
- publish `frontend/dist` to GitHub Pages

In the GitHub repository settings, set Pages to use **GitHub Actions** as the source.
