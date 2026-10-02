CREATE TABLE login_attempts (id TEXT PRIMARY KEY NOT NULL, attempts INTEGER NOT NULL, window INTEGER NOT NULL);
CREATE INDEX idx_login_attempts_window ON login_attempts(window);
CREATE TABLE refresh_jobs (owner TEXT PRIMARY KEY NOT NULL, day TEXT NOT NULL, cursor INTEGER NOT NULL, failed INTEGER NOT NULL, complete INTEGER NOT NULL);
