function requestDeviceOrientation () {
	log("Requesting compass.");
	if (typeof DeviceOrientationEvent !== 'undefined' &&
	    typeof DeviceOrientationEvent.requestPermission === 'function') {
			DeviceOrientationEvent.requestPermission()
			.then(permissionState => {
				if (permissionState === 'granted') {
					log("Compass connected.");
					connected = true;
					window.addEventListener('deviceorientation', (e) => {
						heading.innerHTML = "<h1>" + e.webkitCompassHeading + "</h1>";
					});
				} else {
					log("No compass.");
				}
			})
			.catch(console.error);
		} else {
			// handle regular non iOS 13+ devices
			log("not iOS.");
		}
	}
