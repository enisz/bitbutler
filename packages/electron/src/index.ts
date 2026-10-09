// Electron entry point. Import order matters here: the logger bootstrap must be evaluated
// before main.js pulls in the database. "logger-bootstrap" sorts before "main", so the repo's
// import sorter keeps this order.
import './logger-bootstrap.js';
import './main.js';
