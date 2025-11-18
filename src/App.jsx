import { useEffect, useState } from 'react'
import Search from './components/Search.jsx'
import Spinner from './components/Spinner.jsx'
import MovieCard from './components/MovieCard.jsx'
import { useDebounce } from 'react-use'
import { getTrendingMovies, updateSearchCount } from './appwrite.js'

const API_BASE_URL = 'https://api.themoviedb.org/3';
const API_KEY = import.meta.env.VITE_TMDB_API_KEY;

const API_OPTIONS = {
  method: 'GET',
  headers: {
    accept: 'application/json',Authorization: `Bearer ${API_KEY}`
  }
}

const App = () => {
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [searchTerm, setSearchTerm] = useState('');
  const [movieList, setMovieList] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [trendingMovies, setTrendingMovies] = useState([]);

  useDebounce(() => setDebouncedSearchTerm(searchTerm), 500, [searchTerm])

  const fetchMovies = async (query = '') => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const endpoint = query
        ? `${API_BASE_URL}/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(query)}`
        : `${API_BASE_URL}/discover/movie?sort_by=popularity.desc&api_key=${API_KEY}`;

      const response = await fetch(endpoint, API_OPTIONS);

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Failed to fetch movies: ${response.status} ${response.statusText} ${text}`);
      }

      const data = await response.json();
      const results = Array.isArray(data.results) ? data.results : [];
      setMovieList(results);

      if (query && results.length > 0 && typeof updateSearchCount === 'function') {
        try {
          await updateSearchCount(query, results[0]);
        } catch (e) {
          console.error('updateSearchCount failed', e);
        }
      }

      if (results.length === 0) {
        setErrorMessage('No movies found.');
      }
    } catch (error) {
      console.error(`Error fetching movies: ${error}`);
      setErrorMessage('Error fetching movies. Please check the console and try again.');
      setMovieList([]);
    } finally {
      setIsLoading(false);
    }
  }

  const loadTrendingMovies = async () => {
    try {
      // First try Appwrite collection (if you have popularity counts stored)
      let movies = await getTrendingMovies();

      // If Appwrite is empty or unavailable, fall back to TMDB trending endpoint
      if (!Array.isArray(movies) || movies.length === 0) {
        const tmdbResp = await fetch(`${API_BASE_URL}/trending/movie/week?api_key=${API_KEY}`, API_OPTIONS);
        if (tmdbResp.ok) {
          const tmdbData = await tmdbResp.json();
          movies = (Array.isArray(tmdbData.results) ? tmdbData.results : []).slice(0, 10).map(m => ({
            $id: m.id,
            id: m.id,
            title: m.title || m.name,
            poster_url: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : '',
          }));
        } else {
          movies = [];
        }
      } else {
        // Ensure each Appwrite document has a `poster_url` property
        movies = movies.map(m => ({
          ...m,
          poster_url: m.poster_url || (m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : ''),
        }));
      }

      setTrendingMovies(Array.isArray(movies) ? movies : []);
    } catch (error) {
      console.error(`Error fetching trending movies: ${error}`);
      setTrendingMovies([]);
    }
  }

  useEffect(() => { fetchMovies(debouncedSearchTerm);
  }, [debouncedSearchTerm]);

  useEffect(() => {
    loadTrendingMovies();
  }, []);

  return (
    <main>
      
      <div className="pattern"/>

      <div className="wrapper">
        <header>
          <img src="/logo.png" alt="Logo" className="size-20 mt-0.5" />
          <img src="/hero.png" alt="Hero Banner" className="size-auto" />
          <h1>Find <span className="text-gradient">Movies</span> You will Enjoy Without too much Hassle</h1>

          <Search searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
        </header>

        {trendingMovies.length > 0 && (
          <section className="trending">
            <h2>Trending Movies</h2>

            <ul>
              {trendingMovies.map((movie, index) => (
                <li key={movie.$id || movie.id || index}>
                  <p>{index + 1}</p>
                  <img src={movie.poster_url || ''} alt={movie.title || 'poster'} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="all-movies mt-6">
          <h2>All Movies</h2>

          {isLoading ? (
            <Spinner />
          ) : errorMessage ? (
            <p className="text-red-500">{errorMessage}</p>
          ) : (
            <ul>
              {movieList.map((movie) => (
                <MovieCard key={movie.id} movie={movie} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}

export default App

