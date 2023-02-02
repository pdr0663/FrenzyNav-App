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

var latitude = null;
var longitude = null;
var EARTH = 3440.06479 // Radius of the EARTH in nautical miles

function distance_between( loc1, loc2 ) {
	console.log("distance-between: loc1=",loc1," loc2=",loc2);
	var x = ( loc2[1] - loc1[1] ) * Math.PI / 180 * Math.cos( ( ( loc1[0] + loc2[0] ) / 2 ) * Math.PI / 180 );
	var y = ( loc2[0] - loc1[0] ) * Math.PI / 180;
	var d = EARTH * Math.sqrt( x * x + y * y );
	console.log(" d=",d);
	return d
}

function course_between( loc1, loc2 ) {
	var x = EARTH * ( loc2[1] - loc1[1] ) * Math.PI / 180 * Math.cos( ( ( loc1[0] + loc2[0] ) / 2 ) * Math.PI / 180 );
	var y = EARTH * ( loc2[0] - loc1[0] ) * Math.PI / 180;
	var bearing = 90 - 180 / Math.PI * Math.atan2(y, x);
	if (bearing >= 0)
		return bearing;
	return bearing + 360;
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

function projectDistance(startLat, startLon, distance, bearing) {
	const b = bearing * Math.PI / 180;
	const d = distance / 6371;  // 6371 is the approximate radius of the Earth in kilometers
	const sLat = startLat * Math.PI / 180;
	const sLon = startLon * Math.PI / 180;

	const dLat = Math.asin(Math.sin(sLat) * Math.cos(d) +
												Math.cos(sLat) * Math.sin(d) * Math.cos(b));
	const dLon = sLon + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(sLat),
																		Math.cos(d) - Math.sin(sLat) * Math.sin(dLat));

	// Convert destination coordinates back to degrees
	const destinationLatitude = dLat * 180 / Math.PI;
	const destinationLongitude = dLon * 180 / Math.PI;

	// Create a new point object for the destination coordinates
	return [dLat  * 180 / Math.PI, dLon  * 180 / Math.PI];
}
