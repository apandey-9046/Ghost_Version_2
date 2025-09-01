// index.js

// Register Service Worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("./service-worker.js")
    .then((registration) => {
      console.log("Service Worker registered:", registration);

      // Listen for updates
      registration.onupdatefound = () => {
        const newWorker = registration.installing;
        newWorker.onstatechange = () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            // Show update notification to user
            const updateDiv = document.createElement("div");
            updateDiv.innerHTML = `
              <div style="
                position:fixed;bottom:10px;left:50%;transform:translateX(-50%);
                background:#222;color:#fff;padding:10px 20px;border-radius:8px;
                font-family:sans-serif;z-index:9999;
              ">
                New update available!
                <button id="reloadApp" style="margin-left:10px;padding:5px 10px;">Reload</button>
              </div>`;
            document.body.appendChild(updateDiv);

            document.getElementById("reloadApp").onclick = () => {
              newWorker.postMessage("SKIP_WAITING");
              window.location.reload();
            };
          }
        };
      };
    })
    .catch((error) => console.log("SW registration failed:", error));
}