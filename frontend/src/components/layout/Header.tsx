import { Link } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { useTheme } from '../../context/useTheme';

const SunIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);

const MoonIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const SystemIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);

const themeLabel: Record<string, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

export const Header = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { theme, resolvedTheme, cycleTheme } = useTheme();
  const isOrganizer = user?.role === 'ORGANIZER' || user?.role === 'ADMIN';

  const ThemeIcon = theme === 'system' ? SystemIcon : resolvedTheme === 'dark' ? MoonIcon : SunIcon;

  return (
    <header className="bg-surface shadow-sm border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link to="/" className="text-2xl font-bold text-text">
              Event Platform
            </Link>
          </div>

          <nav className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <Link
                  to="/dashboard"
                  className="text-text-muted hover:text-primary px-3 py-2 rounded-md text-sm font-medium"
                >
                  Dashboard
                </Link>
                <Link
                  to="/events"
                  className="text-text-muted hover:text-primary px-3 py-2 rounded-md text-sm font-medium"
                >
                  Events
                </Link>
                <Link
                  to="/tickets"
                  className="text-text-muted hover:text-primary px-3 py-2 rounded-md text-sm font-medium"
                >
                  My Tickets
                </Link>
                {isOrganizer && (
                  <Link
                    to="/organizer"
                    className="text-primary-700 bg-primary-soft hover:bg-primary-200 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Organizer
                  </Link>
                )}
                <span className="hidden sm:inline text-sm text-text-muted ml-2">
                  Hello, {user?.name}
                </span>
                <button
                  onClick={logout}
                  className="text-text-muted hover:text-primary px-3 py-2 rounded-md text-sm font-medium"
                >
                  Logout
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="text-text-muted hover:text-primary px-3 py-2 rounded-md text-sm font-medium"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="bg-primary text-on-primary hover:bg-primary-700 px-4 py-2 rounded-md text-sm font-medium"
                >
                  Register
                </Link>
              </div>
            )}

            <button
              type="button"
              onClick={cycleTheme}
              aria-label={`Theme: ${themeLabel[theme]}. Click to switch.`}
              title={`Theme: ${themeLabel[theme]}`}
              className="ml-1 p-2 rounded-md text-text-muted hover:text-text hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              <ThemeIcon />
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};
