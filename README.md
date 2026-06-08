# XYZ Collator — Molecular Configuration Builder

A modern, full-stack desktop tool designed to collate multiple `.XYZ` molecular files into a single, perfectly structured DL_POLY-compatible `CONFIG` file. It features customizable coordinate shifts, real-time atom calculations, manual sequencing, and bulk repositioning tools.

---

## Co-Development

The backend was developed personally, making the "engine.py" file, responsible for parsine through the '.XYZ' coordinate structure, and formatting this for the requirements of DL_POLY. The front end however has been vibecoded, because I am still learning HTML :,(

---

## Main Codebase Architecture

The application is light and highly structured:
1.  **`engine.py`**: The main computational script. It executes file parsing, offsets coordinates, re-orders molecular inputs, and compiles the final `CONFIG` string.
2.  **`server.ts`**: The full-stack Express server bridging frontend requests straight to the Python engine via standard I/O pipes.
3.  **`src/App.tsx`**: The primary user interface that includes functional React state management to guarantee inputs update visually instantly while updating safely on the disk behind the scenes.

---

## Features

*   **Cumulative Atom Counter**: Automatically sums up atom counts from every active file and populates the `CONFIG` file header parameters correctly.
*   **Default IMCON 6 support**: Ready-configured out of the box to export standard periodic box geometry headers using boundary conditions specified by standard DL_POLY inputs.
*   **Precision Incremental Offsets (Step Shift)**: Set a global shift step-size and click simple `+` or `-` buttons to instantly nudge molecules along X, Y, or Z axes.
*   **Bulk Shift Actions**: Select multiple files in the view simultaneously to offset entire molecular clusters together.
*   **Sequencing & Order System**: Easily swap the priority order (1-10) of molecules inside your configuration using elegant vertical priority arrows.
*   **Robust Input Handling**: Clean input design allows you to erase/type box configurations without visual inputs breaking or formatting clipping.

---

## How to Run the App Locally

### 1. Prerequisites
Make sure you have the following installed on your system:
*   [Node.js](https://nodejs.org/) (v18 or higher recommended)
*   [Python 3](https://www.python.org/)

### 2. Installation
Extract your downloaded project zip, navigate to the folder, and install the package dependencies with npm:

```bash
npm install
```

### 3. Start the Development Environment
Run the server package:

```bash
npm run dev
```

The portal runs by default on **`http://localhost:3000`**. Open that up in any standard browser to start building!

---

## File Layout Output Reference

The compiled configurations closely mimic the standard expected format structure:

```text
TITLE
          0          6         [Total Atoms Sum]
 [Box Dimension X]   0.00000000   0.00000000
   0.00000000       [Box Dim Y]   0.00000000
   0.00000000        0.00000000  [Box Dim Z]
Element1             1
 [X coordinate]   [Y coordinate]   [Z coordinate]
...
```
