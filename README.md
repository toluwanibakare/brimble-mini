# Brimble Mini-Deployment Platform

Welcome to my take-home project for the Fullstack / Infra Engineer role! This isn't just another standard CRUD app—it's a fully functional, simplified deployment pipeline. Think of it as a mini Heroku or Vercel that runs entirely locally.

The main goal was to build a platform where a user can submit a public Git repository URL, and the system automatically takes over to build it into a container, run it, and route traffic to it, all while streaming live logs back to a sleek frontend interface.

## 🚀 What It Does

When you submit a repository, the platform handles the complete deployment lifecycle automatically:
1. **Builds the project:** Uses [Railpack](https://railpack.com/) to analyze the repository, determine the required build steps, and create a container image (no handwritten Dockerfiles needed!).
2. **Runs the container:** Spins up the newly built image using Docker on an internal network (`brimble`).
3. **Routes traffic dynamically:** Uses **Caddy** as a reverse proxy. It dynamically routes traffic from a custom subdomain (e.g., `http://app-<id>.localhost`) directly to the newly running container.
4. **Streams logs in real-time:** Captures the stdout/stderr from the build and deployment processes and streams them to the frontend terminal UI using **Server-Sent Events (SSE)**. 
5. **Tracks deployment status:** The UI updates dynamically, showing whether the app is `pending`, `building`, `deploying`, `running`, or `failed`. Once it's live, it provides a direct, clickable link to visit the deployed site.

## 🛠 Tech Stack

I kept the stack lean but powerful to meet all the requirements without over-engineering:

- **Frontend:** Vite, React, TypeScript (Single Page Application, no auth needed).
- **Backend:** Node.js with Express & TypeScript.
- **Database:** SQLite (perfect for a lightweight, local-first setup like this).
- **Infrastructure:** Docker, Docker Compose, Caddy, and Railpack.

## 🏗 System Architecture

The whole platform boots up via Docker Compose and consists of four main components:
- **Frontend Container:** Serves the UI. Includes the repository submission form, status badges, and the live log viewer.
- **Backend Container:** The brains of the operation. It exposes a REST API, orchestrates the `git clone`, `railpack build`, and `docker run` commands via child processes, and manages the SSE log streaming.
- **Database:** A mapped SQLite file that stores deployment metadata (container IDs, statuses, generated URLs) and persists historical logs.
- **Caddy Reverse Proxy:** The single ingress point on port 80. It handles API requests, serves the frontend, and most importantly, dynamically reverse-proxies wildcard subdomains to the deployed user applications.

## 🏁 Getting Started

I designed this to be as frictionless as possible to review. You don't need any complex local toolchains installed—just Docker.

To boot the entire system end-to-end, simply clone this repo and run:

```bash
docker compose up --build
```

That's it! Everything boots up automatically. 

Once it's running:
1. Open [http://localhost](http://localhost) in your browser.
2. Submit a repository (for example: `https://github.com/toluwanibakare/rita_project`).
3. Watch the Railpack build stream logs in real-time.
4. Click the **"Visit Site ↗"** link once the deployment status hits `running`.

## 🧠 Notes & Trade-offs

- **Debian Base Image:** The backend Dockerfile uses a Debian-based image (`node:20-bookworm-slim`) instead of Alpine. This was a deliberate choice to ensure seamless compatibility with Railpack and `mise`, which rely heavily on `glibc` rather than Alpine's `musl`.
- **Log Streaming Strategy:** I chose Server-Sent Events (SSE) over WebSockets because log streaming is strictly a one-way communication channel (server -> client). SSE is lighter, has built-in reconnection capabilities, and is much simpler to implement robustly for this specific use case.
- **Process Management:** The backend manages Docker builds via spawned child processes. It also explicitly cleans up any orphaned containers (based on ID) before starting new ones to keep the Docker daemon tidy during repeated deployments.

Thanks for taking the time to review my project. I had a lot of fun building out this pipeline!
