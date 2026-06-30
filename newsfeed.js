let allFeeds = [];

// Function to fetch URL(s)
async function fetch_feed(url, retries = 3) {
  const PROXY = `https://rss-proxy.palumbojordan9.workers.dev/?url=${encodeURIComponent(url)}`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(PROXY);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.text();
      return data;
    } catch (error) {
      console.warn(`Attempt ${attempt} failed for ${url}: ${error.message}`);
      if (attempt === retries) throw error;
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
}

// Function to parse XML gathered from call_feed() function 
function parse_feed(xmlString) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlString, "text/xml");

  // Parsing error checks
  const parseError = xml.querySelector("parsererror");
  if (parseError) {
    console.error("XML parse failed: ", parseError.textContent);
    return {feedTitle: "", entries: []};
  }

  //Grabbing feed-level metadata
  const feedTitle = xml.querySelector("channel > title")?.textContent;

  //Grabs all entries; 
  const items = xml.querySelectorAll("item");
  const entries = [...items].map(item => ({
    title : item.querySelector("title")?.textContent ?? "No title",
    link : item.querySelector("link")?.textContent ?? "",
    pubDate : item.querySelector("pubDate")?.textContent ?? "No date",
  }));

  return {feedTitle, entries};
}

function render_feed(entries, feedTitle, index) {
  const container = document.getElementById("feed_container");
  const section = document.createElement("div");
  section.id = `feed-${index}`;
  section.className = "feed-section";

  //Handles empty results
  if (entries.length === 0) {
    section.innerHTML = `<p> No entries found for "${feedTitle}".</p>`;
    container.appendChild(section);
    return;
  }

  //Build a header for the feed source
  const header = `<h3>${feedTitle ?? `Feed ${index + 1}`}</h3>`;
  
  //Builds one card per entry
  const card = entries.map(entry => `
  <div class = "entry-card">
  <a href="${entry.link}" target = "_blank">
  <h4>${entry.title}</h4>
  </a>
  <p class="pub-date">${entry.pubDate}</p>
  <hr />
  </div>
    `);

  //Inject into webpage
  section.innerHTML = header + card.join("");
  console.log("section innerHTML length: ", section.innerHTML.length);

  container.appendChild(section);
  console.log(`appended feed-${index}, container children:`, container.children.length);
}

function render_all(keyword = "") {
  const container = document.getElementById("feed_container");
  container.innerHTML = "";

  if (allFeeds.length == 0) {
    container.innerHTML = "<p>No feeds loaded yet.</p>";
    return;
  }
  allFeeds.forEach(({feedTitle, entries}, index) => {
    const filtered = keyword.length === 0 
    ? entries 
    : entries.filter(entry =>
    entry.title.toLowerCase().includes(keyword.toLowerCase()) || 
    entry.pubDate.toLowerCase().includes(keyword.toLowerCase())
    );

    render_feed(filtered, feedTitle, index);
  });
}

async function call_feeds() {
  const textarea = document.getElementById("rss_feeds");

  //Splits textarea into array of non-empty trimmed URLs
  const urls = textarea.value 
  .split(/\r?\n/)
  .map(url => url.trim())
  .filter(url => url.length > 0);

  console.log("URLs to fetch: ", urls)

  if (urls.length === 0) {
    console.warn("No URLs entered.")
    return;
  }

  allFeeds = [];
  document.getElementById("feed_container").innerHTML = "";
  console.log(`Fetching ${urls.length} feed(s)...`);

  //Sends all fetch requests in tandem
  const results = await Promise.allSettled(urls.map(url => fetch_feed(url)));

  //Processes each result 
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      const parsed = parse_feed(result.value);
      allFeeds.push(parsed);
    } else {
      console.error(`Feed ${index + 1} failed: `, result.reason.message);
    }

  });
  
  const keyword = document.getElementById("keyword_filter").value.trim();
  render_all(keyword);
}

document.getElementById("keyword_filter").addEventListener("input", function() {
  render_all(this.value.trim());
});
