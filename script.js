/*
"Talk is cheap. Show me the code."
—Linus Torvalds
*/

// Palabas · WS1 TV Show Search code-along (TVmaze API, no key needed)
// Open DevTools (F12): keep the Console AND the Network tab open.
// Sample or live mode: see config.js.

// ---------- Given: page elements ----------
const form = document.getElementById("searchForm");
const input = document.getElementById("query");
const statusText = document.getElementById("status");
const results = document.getElementById("results");
const dialog = document.getElementById("details");
const detailsBody = document.getElementById("detailsBody");
const closeBtn = document.getElementById("closeDetails");
const modeBadge = document.getElementById("modeBadge");

// ---------- Given: the API's URLs ----------
const API = "https://api.tvmaze.com";

// Turns "Breaking Bad" into "breaking-bad" (used for the sample-data file names)
function slug(text) {
  return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// e.g. https://api.tvmaze.com/search/shows?q=breaking%20bad
function searchURL(query) {
  if (USE_SAMPLE_DATA) return `data/search/${slug(query)}.json`;
  return `${API}/search/shows?q=${encodeURIComponent(query)}`;
}

// e.g. https://api.tvmaze.com/shows/169
function showURL(id) {
  return USE_SAMPLE_DATA ? `data/shows/${id}.json` : `${API}/shows/${id}`;
}

// e.g. https://api.tvmaze.com/shows/169/cast
function castURL(id) {
  return USE_SAMPLE_DATA ? `data/cast/${id}.json` : `${API}/shows/${id}/cast`;
}

// e.g. https://api.tvmaze.com/shows/169/seasons
function seasonsURL(id) {
  return USE_SAMPLE_DATA ? `data/seasons/${id}.json` : `${API}/shows/${id}/seasons`;
}

// ---------- Given: helpers (no need to change) ----------

// Shows a message under the search box. type: "info", "loading" or "error"
function setStatus(message, type = "info") {
  statusText.textContent = message;
  statusText.className = "status " + type;
}

// Makes an element with an optional class and text: el("span", "year", "2008")
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// A poster <img>, or a placeholder when the show has no image (image is null)
function createPoster(show, size = "medium") {
  if (!show.image) {
    return el("span", "poster none", "No poster");
  }
  const img = el("img", "poster");
  img.src = show.image[size] || show.image.medium;
  img.alt = `Poster: ${show.name}`;
  img.loading = "lazy";
  img.addEventListener("error", () => img.replaceWith(el("span", "poster none", "No poster")));
  return img;
}

// "2008–2013", or "2016–" for a show that is still running
function yearRange(show) {
  const start = show.premiered ? show.premiered.slice(0, 4) : "?";
  const end = show.ended ? show.ended.slice(0, 4) : "";
  return `${start}–${end}`;
}

// TVmaze summaries contain HTML like "<p><b>Friends</b> follows…</p>".
// This keeps only the text. (Never put text from an API into innerHTML:
// if it contained a <script> or an onerror, it could run on your page.)
function stripTags(html) {
  if (!html) return "No summary yet.";
  return new DOMParser().parseFromString(html, "text/html").body.textContent;
}

// Close the details pop-up (Step 4) with the × button or by clicking outside it
closeBtn.addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});

// Show which mode we're in
modeBadge.textContent = USE_SAMPLE_DATA ? "Sample data" : "Live · TVmaze";
modeBadge.classList.toggle("live", !USE_SAMPLE_DATA);



// STEP 1 — Your first API request ======================================
/*
// This function is used for testing the connection to the API and is not part of the final code so I commented this one out.
async function testRequest() {
  const url = searchURL("friends");
  console.log("Request: ", url); 

  const response = await fetch(url); 
  console.log("Status: ", response.status, "ok?: ", response.ok);

  const data = await response.json();
  console.log(data); 
  console.log("How many: ", data.length);
  console.log("First show: ", data[0].show.name, data[0].show.premiered);
}

testRequest();
*/

// STEP 2 — Search and show the results
// TODO: renderResults(items), searchShows(query), and a submit listener on the form

// This function removes the previous data of result and renders the new movie along with its attributes.
function renderResults(items) {
  results.innerHTML = ""; 

  items.forEach((item) => {
    const movie = item.show; 

    const card = el("button", "card");
    card.type = "button";
    card.dataset.id = movie.id; 

    const rating = movie.rating.average; 
    card.append(
      createPoster(movie),
      el("span", "title", movie.name),
      el("span", "year", yearRange(movie)),
      el("span", "genres", movie.genres.join(", ")),
      el("span", "rating", rating ? `★ ${rating}` : "No Rating")
    );
    results.appendChild(card);
  });
}

form.addEventListener("submit", (event) => {
  event.preventDefault(); 
  const query = input.value.trim();
  if (query === "") return;     
  searchShows(query);
});


// STEP 3 — getJSON(): one careful helper for every request
// TODO: catch network errors, check 429 and response.ok; rewrite searchShows with try / catch and an empty-array check

//This function fetches the JSON data from the URL and handles errors such as network issues, unsuccessful responses, and too many requests for the API.
async function getJSON(url) {
  let response;
  try {
    response = await fetch(url);
  } catch (networkError) {
    throw new Error("Can't reach TVmaze. Check your internet connection.");
  }

  if (response.status === 429) {

      if (!isRetry){
        setStatus("Busy, Retrying...", "loading");
        await new Promise((time) => setTimeout(time, 2000));
        return getJSON(url, true);
      }
    throw new Error("Too many requests (Error 429). Wait 10 seconds and try again.");
  }
  if (!response.ok) {
    throw new Error(
      USE_SAMPLE_DATA
        ? "Local Server knows: friends, office, breaking bad, stranger things, sherlock, thrones, sample."
        : `Request failed (HTTP ${response.status}).`
    );
  }
  return response.json();
}

// This function searches for movies based on the title searched for by the user. 
async function searchShows(title) {
  setStatus(`Searching for "${title}"…`, "loading");
  results.innerHTML = "";

  try {
    const data = await getJSON(searchURL(title));

    if (data.length === 0) {
      setStatus(`No shows found for "${title}". Check the spelling.`, "error");
      return;
    }
    renderResults(data);
    setStatus(`${data.length} ${data.length === 1 ? "show" : "shows"} found for "${title}"`);
  } catch (error) {
    setStatus(error.message, "error");
  }
}


// STEP 4 — Click a show to see its details
// TODO: one click listener on #results, showDetails(id), renderDetails(show)
/*
results.addEventListener("click", (event) => {
  const card = event.target.closest(".card");
  if (card) showDetails(card.dataset.id);
});

// This function fetches the details of a movie based on the id of the movie clicked by the user.
async function showDetails(id) {
  detailsBody.replaceChildren(el("p", "status loading", "Loading details…"));
  dialog.showModal();

  try {
    const show = await getJSON(showURL(id));
    renderDetails(show);
  } catch (error) {
    detailsBody.replaceChildren(el("p", "status error", error.message));
  }
}

// This function renders the details of the movie; its title, year, genre, rating, and plot.
function renderDetails(show) {
  const where = show.network ? show.network.name : show.webChannel ? show.webChannel.name : "";
  const minutes = show.runtime || show.averageRuntime; 

  const info = el("div", "info");
  info.append(
    el("h2", "", show.name),
    el("p", "meta", [yearRange(show), where, show.genres.join(", "), minutes ? `${minutes} min` : ""].filter(Boolean).join(" · ")),
    el("p", "score", show.rating.average ? `★ ${show.rating.average} / 10` : "Not rated yet"),
    el("p", "plot", stripTags(show.summary)) 
  );

  const links = el("p", "links");
  const tvmaze = el("a", "", "View on TVmaze ↗");
  tvmaze.href = show.url;
  tvmaze.target = "_blank";
  links.append(tvmaze);
  info.append(links);

  detailsBody.replaceChildren(createPoster(show, "original"), info);
}
*/

// STEP 5 — Promise.all: show + cast + seasons at the same time
// TODO: rewrite showDetails with Promise.all, and renderDetails(show, cast, seasons)
  
results.addEventListener("click", (event) => {
  const card = event.target.closest(".card");
  if (card) showDetails(card.dataset.id);
});

//This function is an improved version of the previous showDetails function. 
//It fetches the details of a movie, the casts, and the seasons of the movie which uses Promise.all to fetch the data at the same time.
async function showDetails(id) {
  detailsBody.replaceChildren(el("p", "status loading", "Loading details…"));
  dialog.showModal();

  try {
    const [show, cast, seasons] = await Promise.all([
      getJSON(showURL(id)),
      getJSON(castURL(id)),
      getJSON(seasonsURL(id))
    ]);
    renderDetails(show, cast, seasons);
  } catch (error) {
    detailsBody.replaceChildren(el("p", "status error", error.message));
  }
}

//This function is also an improved version of the previous renderDetails function. 
//It renders the complete details of the movie, its title, year, genre, rating, plot, cast, and seasons.
function renderDetails(show, cast, seasons) {
  const where = show.network ? show.network.name : show.webChannel ? show.webChannel.name : "";
  const minutes = show.runtime || show.averageRuntime;
  const seasonsCount = seasons.length ? `${seasons.length} ${seasons.length === 1 ? "season" : "seasons"}` : "";

  const info = el("div", "info");
  info.append(
    el("h2", "", show.name),
    el("p", "meta", [yearRange(show), where, seasonsCount, show.genres.join(", "), minutes ? `${minutes} min` : ""].filter(Boolean).join(" · ")),
    el("p", "score", show.rating.average ? `★ ${show.rating.average} / 10` : "Not rated yet"),
    el("p", "plot", stripTags(show.summary)) 
  );

  if (cast && cast.length > 0) {
    const topCast = cast.slice(0, 5).map(c => c.person.name).join(", ");
    info.append(el("p", "cast", `Starring: ${topCast}`));
  }

  const links = el("p", "links");
  const tvmaze = el("a", "", "View on TVmaze ↗");
  tvmaze.href = show.url;
  tvmaze.target = "_blank";
  links.append(tvmaze);
  info.append(links);

  detailsBody.replaceChildren(createPoster(show, "original"), info);
}