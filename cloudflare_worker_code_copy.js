// https://developers.cloudflare.com/workers/examples/alter-headers/
// https://developers.cloudflare.com/workers/examples/cors-header-proxy/

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {

  // The worker should be called as follows (for example):
  // https://arxiv-digest-fetcher.nicolasboumal.workers.dev/?category=math.NA
  const url = new URL(request.url);
  const category = url.searchParams.get('category');

  const response = await fetch("https://export.arxiv.org/rss/" + category, { cf: { cacheTtl: -1 } });

  // Clone the response so that it's no longer immutable
  const newResponse = new Response(response.body, response);

  // Add a custom header with a value
  newResponse.headers.append('Access-Control-Allow-Origin', '*');
  newResponse.headers.append('Access-Control-Allow-Methods', 'GET,HEAD,POST,OPTIONS');
  newResponse.headers.append('Access-Control-Max-Age', '0');

  // Delete headers
  //newResponse.headers.delete('x-header-to-delete');
  //newResponse.headers.delete('x-header2-to-delete');

  // Adjust the value for an existing header
  //newResponse.headers.set('x-header-to-change', 'NewValue');

  return newResponse;
}
