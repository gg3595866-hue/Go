import axios from 'axios';

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

interface GetOptions {
  uri: string;
  headers?: Record<string, string>;
}

type Callback = (error: any, response: any, body: string) => void;

export const httpClient = {
  get(options: GetOptions, callback: Callback): void {
    const { uri, headers = {} } = options;
    axios.get(uri, {
      headers: { ...DEFAULT_HEADERS, ...headers },
      responseType: 'text',
      timeout: 30000,
    })
      .then((response) => {
        callback(null, response, response.data as string);
      })
      .catch((error) => {
        callback(error, null, '');
      });
  },
};

export default httpClient;
