# Frenzy Navigation V2

V2 is independent of the original app at the repository root.

After the `main` branch is published through GitHub Pages:

- V1: <https://pdr0663.github.io/FrenzyNav-App/>
- V2: <https://pdr0663.github.io/FrenzyNav-App/V2/>

V2 uses storage keys prefixed with `FrenzyNavV2.`, so it does not read or overwrite
the temporary marks saved by V1.

## Bearing behaviour

One global setting applies everywhere:

- **TRUE**: displayed courses and manually entered sightings are true.
- **MAGNETIC**: displayed courses and manually entered sightings are magnetic.

Phone compass readings are magnetic sensor readings. V2 silently applies the
saved declination whenever conversion is required for its coordinate calculations.
There is no per-sighting true/magnetic choice.

## Top-mark sightings

Open **Race Setup**, then **Locate from Sightings**.

- **Phone sighting**: point the phone's top edge at the mark, hold the phone
  approximately flat, start the compass, and capture when the reading is stable.
- **Manual sighting**: enter the committee vessel's displayed bearing and capture.
  V2 stores the phone's current GPS position with the entered bearing.

At least two well-separated sightings are required. V2 will not accept a result
classified as poor.

## Tests

From the repository root:

```powershell
node .\V2\navigation.test.js
node .\V2\app.test.js
```
