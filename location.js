/**
 * Distance between two coordinates (lite)
 *
 * @author Salvador Dali
 * @author AnttiK / OiOi
 *
 * @param { number } lat_1 - Latitude of first point
 * @param { number } lon_1 - Longitude of first point
 * @param { number } lat_2 - Latitude of second point
 * @param { number } lon_2 - Longitude of second point
 *
 * @see http://stackoverflow.com/a/21623256
 * @see https://en.wikipedia.org/wiki/Haversine_formula
 *
 * @return { number } Distance in km
 */

var EARTH = 3440.06479 // Radius of the EARTH in nautical miles

function fix_bearing(bearing) {
	if (bearing >= 360.0)
		return bearing -360.0;
	else if (bearing < 0.0)
	    return bearing + 360.0;
	else
		return bearing;
}

function distance_between( loc1, loc2 ) {
	// simple pythagorean distance for small distances
	var x = ( loc2[1] - loc1[1] ) * Math.PI / 180 * Math.cos( ( ( loc1[0] + loc2[0] ) / 2 ) * Math.PI / 180 ); // longitude
	var y = ( loc2[0] - loc1[0] ) * Math.PI / 180; // latitude
	var d = EARTH * Math.sqrt( x * x + y * y );
	return d
}

function course_between( loc1, loc2 ) {
	var x = EARTH * ( loc2[1] - loc1[1] ) * Math.PI / 180 * Math.cos( ( ( loc1[0] + loc2[0] ) / 2 ) * Math.PI / 180 );
	var y = EARTH * ( loc2[0] - loc1[0] ) * Math.PI / 180;
	var bearing = 90 - 180 / Math.PI * Math.atan2(y, x);
	return fix_bearing(bearing)
}

function watchLocation(success) {
	var options = {
		enableHighAccuracy: true,
		timeout: 7000,
		maximumAge: 0
    }
 
	 if (navigator.geolocation) {
		// navigator.geolocation.watchPosition(function () {}, function () {}, {});
		navigator.geolocation.watchPosition(success, function () {}, options);
		return "Request completed.";
	} else { 
		console.log("Geolocation not supported");
		return "Geolocation is not supported by this browser";
	}
}
	  
function failure(error) {
	switch(error.code) {
		case error.PERMISSION_DENIED:
			console.log("User denied the request for Geolocation.");
			break;
		case error.POSITION_UNAVAILABLE:
			console.log("Location information is unavailable.");
			break;
		case error.TIMEOUT:
			console.log("The request to get user location timed out.");
			break;
		case error.UNKNOWN_ERROR:
			console.log("An unknown error occurred.");
			break;
	}
}

function projectDistance(start, distance, bearing) {
	console.log('project distance');
	console.log(start, distance, bearing);
	const b = bearing * Math.PI / 180;
	const d = distance / EARTH;  // EARTH is the approximate radius of the Earth
	const sLat = start[0] * Math.PI / 180;
	const sLon = start[1] * Math.PI / 180;

	const dLat = Math.asin(Math.sin(sLat) * Math.cos(d) +
												Math.cos(sLat) * Math.sin(d) * Math.cos(b));
	const dLon = sLon + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(sLat),
																		Math.cos(d) - Math.sin(sLat) * Math.sin(dLat));

	// Create a new point object for the destination coordinates
	return [dLat  * 180 / Math.PI, dLon  * 180 / Math.PI];
}
