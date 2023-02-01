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
var Earth = 6371; // Radius of the Earth in km

function distance_between( lat_1, lon_1, lat_2, lon_2 ) {
	var x = ( lon_2 - lon_1 ) * Math.PI / 180 * Math.cos( ( ( lat_1 + lat_2 ) / 2 ) * Math.PI / 180 );
	var y = ( lat_2 - lat_1 ) * Math.PI / 180;
	return Earth * Math.sqrt( x * x + y * y );
}

function course_between( lat_1, lon_1, lat_2, lon_2 ) {
	var x = Earth * ( lon_2 - lon_1 ) * Math.PI / 180 * Math.cos( ( ( lat_1 + lat_2 ) / 2 ) * Math.PI / 180 );
	var y = Earth * ( lat_2 - lat_1 ) * Math.PI / 180;
	bearing = 90 - 180 / Math.PI * Math.atan2(y, x);
	if (bearing >= 0)
		return bearing;
	else
		return bearing + 360;
}

var options = {
   	enableHighAccuracy: true,
   	timeout: 7000,
   	maximumAge: 0
}

function watchLocation(success) {
	if (navigator.geolocation) {
		navigator.geolocation.watchPosition(function () {}, function () {}, {});
		navigator.geolocation.watchPosition(success, failure, options);
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
	const bearingRadians = bearing * Math.PI / 180;
	const distanceRadians = distance / 6371;  // 6371 is the approximate radius of the Earth in kilometers
	const startLatitudeRadians = startLat * Math.PI / 180;
	const startLongitudeRadians = startLon * Math.PI / 180;

	const destinationLatitudeRadians = Math.asin(Math.sin(startLatitudeRadians) * Math.cos(distanceRadians) +
												Math.cos(startLatitudeRadians) * Math.sin(distanceRadians) * Math.cos(bearingRadians));
	const destinationLongitudeRadians = startLongitudeRadians + Math.atan2(Math.sin(bearingRadians) * Math.sin(distanceRadians) * Math.cos(startLatitudeRadians),
																		Math.cos(distanceRadians) - Math.sin(startLatitudeRadians) * Math.sin(destinationLatitudeRadians));

	// Convert destination coordinates back to degrees
	const destinationLatitude = destinationLatitudeRadians * 180 / Math.PI;
	const destinationLongitude = destinationLongitudeRadians * 180 / Math.PI;

	// Create a new point object for the destination coordinates
	return [destinationLongitude, destinationLatitude];
}
