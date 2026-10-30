-- Run once by the Postgres container on first start (docker compose).
CREATE DATABASE lms_test OWNER lms;
CREATE DATABASE lms_e2e OWNER lms;
