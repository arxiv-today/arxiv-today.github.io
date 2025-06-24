// Add event listener for fetch events
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

/**
 * A resilient fetch function that retries on failure.
 * @param {string} url - The URL to fetch.
 * @param {object} fetchOptions - The options to pass to the fetch() call (e.g., headers, cf).
 * @param {object} retryOptions - Configuration for the retry mechanism.
 * @param {number} retryOptions.retries - The total number of attempts to make.
 * @param {number} retryOptions.delay - The delay in milliseconds between retries.
 */
async function fetchWithRetry(url, fetchOptions, retryOptions = { retries: 3, delay: 300 }) {
  const { retries, delay } = retryOptions;

  for (let i = 0; i < retries; i++) {
    try {
      // Attempt to fetch the resource
      const response = await fetch(url, fetchOptions);

      // If the response status is not ok (e.g., 5xx error from arXiv),
      // throw an error to trigger the retry mechanism.
      if (!response.ok) {
        throw new Error(`Upstream server returned an error: HTTP ${response.status}`);
      }

      // If the fetch was successful, return the response immediately.
      return response;
    } catch (error) {
      console.log(`Attempt ${i + 1} of ${retries} failed. Retrying in ${delay}ms... Error: ${error.message}`);

      // If this was the last attempt, re-throw the error to be caught by the main handler.
      if (i === retries - 1) {
        throw error;
      }

      // Wait for the specified delay before the next attempt.
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Main function to handle incoming requests.
 * @param {Request} request
 */
async function handleRequest(request) {
  // The worker should be called as follows (for example):
  // https://arxiv-digest-fetcher.nicolasboumal.workers.dev/?category=math.NA
  const url = new URL(request.url);
  const category = url.searchParams.get('category');

  // If the category parameter is missing, return a client error.
  if (!category) {
    return new Response('Missing "category" query parameter in the URL.', { status: 400 });
  }

  const arxivUrl = `https://export.arxiv.org/rss/${category}`;
  const fetchOptions = {
    // This Cloudflare-specific option tells the edge not to cache the response from arXiv.
    // This ensures your users always get the latest digest.
    cf: { cacheTtl: -1 }
  };

  try {
    // Use our new resilient fetch function instead of the standard fetch
    const response = await fetchWithRetry(arxivUrl, fetchOptions);

    // Clone the response so that it's no longer immutable
    const newResponse = new Response(response.body, response);

    // Add the necessary CORS headers to allow your website to access the data
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    newResponse.headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    newResponse.headers.set('Access-Control-Max-Age', '0'); // Needed?

    return newResponse;

  } catch (error) {
    // This block runs only if all retry attempts fail.
    console.error(`Failed to fetch from arXiv for category "${category}" after all retries. Final error:`, error.message);

    // Return a "Bad Gateway" error, which is the appropriate status code when
    // an upstream server (arXiv) is unreachable.
    return new Response(`Could not retrieve data from arXiv.org. ${error.message}`, { status: 502 });
  }
}
