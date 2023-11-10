  const INTERVAL = 2000; // milliseconds
  const WINGMARKANGLE = 45.0;
  //var setMark = document.getElementById("setMark");
  var stats = {
    time: null,
    location: [-33,151], // init with dummy location data
    locationQueue: [[-33,151],[-33,151],[-33,151]],
    speed: null,
    course: null,
    targetMark: null,
    targetDistance: 99.9,
    targetCourse: 0,
    marks: {
      "Top Mark": { // temporary mark, pinged
        status: "disabled",
        location: null,
      },
      "Wing Mark Port": { // temporary mark, computed from top and bottom mark locations
        status: "disabled",
        location: null
      },
      "Wing Mark Stbd": { // temporary mark, computed from top and bottom mark locations
        status: "disabled",
        location: null
      },
      "Bottom Mark": { // temporary mark, pinged
        status: "disabled",
        location: null,
      },
      'Ramsgate': {
        status: "enabled",
        location: [-(33+59.193/60),151+9.229/60]
      },
      'Brighton': {
        status: "enabled",
        location: [-(33+57.768/60),151+9.694/60]
      },
      'Airport': {
        status: "enabled",
        location: [-(33+58.576/60),151+11.330/60]
      },
      'Kurnell': {
        status: "enabled",
        location: [-(34+0.130/60),151+12.128/60]
      },
      'Quibray': {
        status: "enabled",
        location: [-(34+0.137/60),151+11.005/60]
      },
      'Outer Towra': {
        status: "enabled",
        location: [-(33+59.434/60),151+9.791/60]
      },
      'Taylor Bar': { // outermost of two piles
        status: "enabled",
        location: [-(33+59.474/60),151+9.426/60]
      },
      'Captain Cook': { // Captain Cook Buoy: Red pillar buoy (lat. 33º 59.9’S; long. 151º 13.1’E)
        status: "enabled",
        location: [-(33+59.9/60),151+13.1/60]
      },
      'Waverider': { // Yellow Spherical buoy with aerial (lat. 34 02.43’S; long. 151º 15.18’E)
                    // approximately 1NM East of Cape Baily
        status: "enabled",
        location: [-(34+2.43/60),151+15.18/60]
      }
    }
  }

  function startUp() {
    console.log("FRENZY NAV APP");
    
    // Check for previous save of top and bottom marks...
    localforage.getItem('Top Mark', function(err, value) {
      if (err) {
        console.error(err);
      } else {
        console.log('Data loaded from cloud storage: ', value);
        if (value != null) {
          var m = document.getElementById('Top Mark');
          m.className = 'enabled';
          stats.marks['Top Mark'].location = value;
        }
      }
    });
    localforage.getItem('Bottom Mark', function(err, value) {
      if (err) {
        console.error(err);
      } else {
        console.log('Data loaded from cloud storage: ', value);
        var m = document.getElementById('Bottom Mark');
        m.className = 'enabled';
        stats.marks['Bottom Mark'].location = value;
      }
    });

    // Update status of mark buttons on home page
    for (mark in stats.marks) {
      console.log(mark);
      var m = document.getElementById(mark);
      m.className = stats.marks[mark].status;
      console.log(mark, " button set to " , m.className)
    }
    computeWingMarks();
    setInterval('UpdateUI()', INTERVAL);
    watchLocation(updatePosition);
  }  

  function updatePosition(position) {
    var time = Date.now();
    var newPos = [position.coords.latitude,position.coords.longitude];
    if (stats.locationRaw) {
      var deltaX = distance_between(stats.locationRaw, newPos);
      var deltaC = course_between(stats.locationRaw, newPos);
      console.log((deltaX*1852).toFixed(2), "@", deltaC.toFixed(0));
    }
    stats.locationRaw = newPos;
    stats.locationQueue.shift();
    stats.locationQueue.push(stats.locationRaw);
    var location = [(0.1*stats.locationQueue[0][0]+0.25*stats.locationQueue[1][0]+0.65*stats.locationQueue[2][0]),
                (0.1*stats.locationQueue[0][1]+0.25*stats.locationQueue[1][1]+0.65*stats.locationQueue[2][1])];
    if (time != null && stats.time) {
      stats.speed = distance_between(stats.location, location)/((time-stats.time)/1000/3600); // in knots since distance is NM
      stats.course = course_between(stats.location, location);
    }
    if (stats.targetMark) {
      stats.targetDistance = distance_between(location, stats.marks[stats.targetMark].location);
      stats.targetCourse =   course_between(location, stats.marks[stats.targetMark].location);
    }
    stats.time = time;
    stats.location = location;
  }

  function error(err) {
    console.log(`ERROR(${err.code}): ${err.message}`);
  }

  function formatFloat(num) {
    if (num > 99.9 || num < 0.0) return '-.--';
    if (num >= 10.0) return num.toFixed(1);
    return num.toFixed(2);
  }

  function formatCourse(num) {
    if (num < 0) return "---";
    str = (num % 360.0).toFixed(0).toString();
    if (str.length == 3) return str;      
    if (str.length == 2) return "0"+str;
    return "00"+str;
  }

  function UpdateUI() {
    var nxtDistance = document.getElementById('nxtDistance');
    var nxtCourse = document.getElementById('nxtCourse');
    var curCourse = document.getElementById("curCourse");
    var curSpeed = document.getElementById("curSpeed");
    //navigator.geolocation.getCurrentPosition(updatePosition);
    if (stats.speed) curSpeed.innerText = formatFloat(stats.speed);
    if (stats.course) curCourse.innerText = formatCourse(stats.course);
    if (stats.targetMark) {
      nxtDistance.innerText = formatFloat(stats.targetDistance);
      nxtCourse.innerText = formatCourse(stats.targetCourse);
    }  
  }

  function markButtonClicked(mark) {
    if (stats.targetMark) document.getElementById(stats.targetMark).className = stats.marks[stats.targetMark].status;
    if (stats.marks[mark].status == "enabled") {
      stats.targetMark = mark;
      document.getElementById(mark).className = "target";
    } else { // clicked on a disabled button, assume user meant to cancel target
      stats.targetMark = null;
    }
  }

  function setMarkClicked(mark) {
    stats.marks[mark].location = stats.locationRaw;
    stats.marks[mark].status = 'enabled';
    document.getElementById(mark).className = 'enabled';
    // Save data
    localforage.setItem(mark, stats.marks[mark].location, function(err, value) {
      if (err) {
        console.error(err);
      } else {
        console.log('Data is saved to cloud storage ', stats.marks[mark].location);
      }
    });
    computeWingMarks();
    }

    function cancelMarkClicked(mark) {
    stats.marks[mark].location = null;
    stats.marks[mark].status = 'disabled';
    document.getElementById(mark).className = 'disabled';
    localforage.removeItem(mark, function(err) {
      if (err) {
        console.error(err);
      } else {
        console.log('Data is removed from local storage ', stats.marks[mark].location);
      }
    });
    // Cancelling any mark will necessitate cancelling wing marks
    stats.marks['Wing Mark Port'].location = null;
    stats.marks['Wing Mark Port'].status = 'disabled';
    document.getElementById('Wing Mark Port').className = 'disabled';
    stats.marks['Wing Mark Stbd'].location = null;
    stats.marks['Wing Mark Stbd'].status = 'disabled';
    document.getElementById('Wing Mark Stbd').className = 'disabled';
  }

  function computeWingMarks() {
    if (stats.marks['Top Mark'].status == 'enabled' && stats.marks["Bottom Mark"].status == 'enabled' &&
      !coincident(stats.marks['Top Mark'].location, stats.marks["Bottom Mark"].location, 0.00001)) {
      console.log('computing wing marks');
      console.log("Debug");
      console.log(stats.marks['Top Mark'].location);
      console.log(stats.marks['Bottom Mark'].location);
      
      stats.marks['Wing Mark Port'].location = projectDistance(
        stats.marks['Bottom Mark'].location,
        0.7071 * distance_between(stats.marks['Bottom Mark'].location, stats.marks['Top Mark'].location),
        fix_bearing(course_between(stats.marks['Bottom Mark'].location, stats.marks['Top Mark'].location) - WINGMARKANGLE)
      )
      enable('Wing Mark Port');
      
      stats.marks['Wing Mark Stbd'].location = projectDistance(
        stats.marks['Bottom Mark'].location,
        0.7071 * distance_between(stats.marks['Bottom Mark'].location, stats.marks['Top Mark'].location),
        fix_bearing(course_between(stats.marks['Bottom Mark'].location, stats.marks['Top Mark'].location) + WINGMARKANGLE)
      )
      enable('Wing Mark Stbd');

      console.log(stats.marks['Wing Mark Port'].location);
      console.log(stats.marks['Wing Mark Stbd'].location);

      console.log('compute wing marks finished');
    }  
  }

  function coincident(loc1, loc2, tol) {
    return (Math.abs(loc1[0]-loc2[0]) < tol) && (Math.abs(loc1[1]-loc2[1]) < tol)
  }

  function enable(mark) {
    stats.marks[mark].status = 'enabled';
    document.getElementById(mark).className = 'enabled';
}
