# Test qBittorrent for the RSS view (#337)

A throwaway qBittorrent 5.2.3 plus a local test RSS feed, in one Docker Compose file. It exists only to develop and verify the RSS view. It is removed with the rest of `docs/superpowers` before the PR is opened.

Everything below is run from the **repository root**, with `sudo` (Ubuntu Server).

## Start (one line)

```bash
sudo docker compose -f docs/superpowers/test-env/docker-compose.yml up -d
```

Needs Docker Compose v2.23.1 or newer (check with `docker compose version`; on Ubuntu install or upgrade with `sudo apt-get install docker-compose-plugin` from Docker's apt repository). The first start pulls three small images.

## Delete everything (one line)

```bash
sudo docker compose -f docs/superpowers/test-env/docker-compose.yml down -v --rmi all
```

This removes the containers, the network, both named volumes (config and downloads) and the pulled images. No host directories are ever created, so nothing else needs cleaning. Use `down -v` without `--rmi all` to keep the images for a faster next start.

To reset to a pristine, freshly seeded state: run the delete line without `--rmi all`, then the start line.

## Login (no manual password step)

The compose file pre-seeds the qBittorrent config, so the WebUI login is fixed:

|                            |                                                                                               |
| -------------------------- | --------------------------------------------------------------------------------------------- |
| WebUI                      | `http://127.0.0.1:8080`                                                                       |
| Username                   | `admin`                                                                                       |
| Password                   | `bitbutler-test`                                                                              |
| Test feed (served locally) | `http://127.0.0.1:8081/torrents.xml` (inside the compose network: `http://feed/torrents.xml`) |

Fallback, only if the seeded login ever fails: qBittorrent prints a temporary random password in its log: `sudo docker logs bb-rss-test-qbittorrent-1 2>&1 | grep -i password`.

Host-header and CSRF checks are switched off in this instance, so any mapped port or hostname works. Never expose it beyond a trusted network; the password is public in this repo.

## What is seeded

A one-shot `qb-seed` container logs in and subscribes qBittorrent to two feeds:

1. **Test Feed** (`http://feed/torrents.xml`), six items covering every code path of the RSS view:

   | Item                            | Exercises                                                                                      |
   | ------------------------------- | ---------------------------------------------------------------------------------------------- |
   | Enclosure Item                  | enclosure + `category` "Movies" + `contentLength` (Size row, chip, Download enabled)           |
   | Magnet Item                     | magnet URI in `<link>` (Download enabled)                                                      |
   | [Distribution] - Plain Web Link | news-style web link (chip parsed from the title prefix, Download **disabled**, Open link only) |
   | Link Only Torrent               | `<link>` ending in `.torrent`, no enclosure (Download enabled)                                 |
   | [Anime] - Nyaa Style Size       | textual `size` "1.2 GiB" + enclosure                                                           |
   | HTML Description                | `<script>` and tags in the description must render as plain text                               |

2. **FOSS Torrents** (`https://fosstorrents.com/feed/rss.xml`), a real news-style feed with about 50 items (needs internet from the server).

RSS processing is **left off** on purpose, so the "RSS fetching is disabled" banner can be tested. Turn it on from the app (banner button, or the RSS tab in qBittorrent Settings), or with curl:

```bash
COOKIE=/tmp/qb.cookie
curl -s -c "$COOKIE" -o /dev/null -d 'username=admin&password=bitbutler-test' http://127.0.0.1:8080/api/v2/auth/login
curl -s -b "$COOKIE" --data-urlencode 'json={"rss_processing_enabled":true}' http://127.0.0.1:8080/api/v2/app/setPreferences
curl -s -b "$COOKIE" "http://127.0.0.1:8080/api/v2/rss/items?withData=true"
```

A successful login is HTTP 204 with an empty body in qBittorrent 5.x. Feeds fetch a few seconds after processing is enabled; `curl -s -b "$COOKIE" -d 'itemPath=Test Feed' http://127.0.0.1:8080/api/v2/rss/refreshItem` forces a refresh. `sample-rss-items.json` next to this file is a real `rss/items?withData=true` response for the Test Feed, captured from qBittorrent 5.2.3.

Downloading the enclosure items will fail on the qBittorrent side (`sample.torrent` etc. do not exist); that is fine, the goal is the prefilled Add Torrent modal. Magnet items can be added for real.

## Ports and remote access

- By default both ports are bound to `127.0.0.1` on the server. If 8080 or 8081 are taken, change them (note `sudo env ...`, plain `sudo VAR=...` does not always pass variables):

  ```bash
  sudo env QB_WEBUI_PORT=8090 FEED_PORT=8091 docker compose -f docs/superpowers/test-env/docker-compose.yml up -d
  ```

  Use the same variables on the delete line if you changed them.

- The server is headless, so the BitButler desktop app cannot run on it. To use the GUI from your desktop, tunnel the WebUI port and add a server in BitButler at `localhost:8080` (user `admin`, password `bitbutler-test`):

  ```bash
  ssh -L 8080:127.0.0.1:8080 <user>@<server>
  ```

  Or start with `QB_BIND=0.0.0.0` (same `sudo env` form) to listen on all interfaces, but only on a trusted network.

- The BitButler code runs its tests with jsdom and needs no display, so unit tests, lint and builds all work headless.
