var ENDPOINT = "https://query.wikidata.org/sparql";

var encodeQuery = query => {
    return ENDPOINT + "?query=" + encodeURIComponent(query);
};

var queryItem = englishWord => {
    var query = "SELECT ?item  (count(?label) as ?c)  where { " +
	"?item rdfs:label \"" + englishWord + "\"@en . " +
	"?item rdfs:label ?label . " +
	"FILTER NOT EXISTS { ?item wdt:P31 wd:Q101352 . } " +
	"SERVICE wikibase:label { bd:serviceParam wikibase:language \"en\" . } " +
	"} " +
	"group by ?item " +
	"ORDER BY DESC(?c) " +
	"LIMIT 1 ";
    console.log(query);
    return encodeQuery(query);
};

var queryTranslations = item => {
    var query = "SELECT DISTINCT ?label ?langLabel ?lon ?lat { " +
        "<" + item + "> rdfs:label ?label . " +
        "bind(lang(?label) as ?code) . " +
        "?lang wdt:P424 ?code . " +     //wikimedia code             
        "?lang p:P625 ?coordinate . " +
        "?coordinate psv:P625 ?coordinate_node . " +
        "?coordinate_node wikibase:geoLongitude ?lon . " +
        "?coordinate_node wikibase:geoLatitude ?lat . " +
        "SERVICE wikibase:label { bd:serviceParam wikibase:language \"en\" . } " +
        "}";
    console.log(query);
    return encodeQuery(query);
};

var getXMLHttpRequest = url => {
    return rxjs.Observable.create(observer => {
        const req = new XMLHttpRequest();
        req.open('GET', url);
        req.overrideMimeType('application/sparql-results+json');
        req.onload = () => {
            if (req.status === 200) {
                observer.next(req.responseText);
                observer.complete();
            } else {
                observer.error(new Error(req.statusText));
            }
        };
        req.crossDomain =true;
        req.onerror = () => {
            observer.error(new Error("An error occured"));
	    d3.selectAll(".label").remove();
	    d3.select("#map")
		.append("text")
		.attr("class", "messagenotfound")
		.attr("x", w/2)
		.attr("y", h/2)
		.html("word not found")
        };
        req.setRequestHeader('Accept', 'application/json, text/javascript');
        req.send();
    });
};

//for tooltip 
var offsetL = document.getElementById("svgdiv").offsetLeft + 30;
var offsetT = document.getElementById("svgdiv").offsetTop + 30;
var points; //set of points; each point represents a word

var tooltip = d3.select("#svgdiv")
    .append("div")
    .attr("class", "tooltip hidden");

// load geojson   
d3.json("globe.json", json => {
    //to do: improve display of country names using a voronoi tessellation with d3 v4
    //see https://bl.ocks.org/Fil/b91d97962d99be2145853c0cfb9c115d

    // width and height                
    var w = window.innerWidth;
    var h = window.innerHeight;
    
    // scale globe to size of window
    var scl = Math.min(w, h)/2.5,
	currentScl = scl;
    
    // map projection        
    var projection = d3.geoOrthographic()
	.scale(scl)
	.translate([w/2, h/2]);
    
    var path = d3.geoPath()
	.projection(projection);
    
    // append svg       
    var svg = d3.select("#svgdiv")
	.append("svg")
	.attr("width", w)
	.attr("height", h);

    // append g element for map                                  
    var map = svg.append("g")
	.attr("id", "map");
    
    // enable drag         
    var drag = d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged);
    
    var gpos0, o0, gpos1, o1;
    svg.call(drag);
    
    // enable zoom                   
    var zoom = d3.zoom()
        .scaleExtent([0.75, 50]) //bound zoom                                       
        .on("zoom", zoomed);
    
    svg.call(zoom);

    function showCountryTooltip(d) {
	var label = "<b>" + d.properties.NAME_ENGL + "</b>";
	console.log(points)
	if (typeof points !== 'undefined' && points.length > 0) {
            var tooltipArray = points.filter(p => d3.geoContains(d, p.coordinates))
		.map(p => p.label + " (" + p.language + ")");
            if (typeof tooltipArray !== undefined && tooltipArray.length > 0) {
		label += "<hr>";
		label += [...new Set(tooltipArray)].join("<br>");
            }
	}
	var mouse = d3.mouse(svg.node())
            .map(d => parseInt(d));
	tooltip.classed("hidden", false)
	    .attr("style", "left:" + (mouse[0]+offsetL) + "px;top:" + (mouse[1]+offsetT) + "px;")
	    .html(label);
    }

    function showWordTooltip(d) {
        var label = d.label + " (" + d.language + ")";
        var mouse = d3.mouse(svg.node())
            .map(d => parseInt(d));
	tooltip.classed("hidden", false)
            .attr("style", "left:" + (mouse[0]+offsetL) + "px;top:" + (mouse[1]+offsetT) + "px;")
            .html(label);
    }

    map.append("path")
        .datum({type: "Sphere"})
        .attr("class", "ocean")
        .attr("d", path)
	.on("mouseover", tooltip.classed("hidden", true));
    
    map.selectAll("lands")
	.data(json.features)
	.enter()
	.append("path")
	.attr("class", "land")
	.attr("d", path)
	.on("mouseover", showCountryTooltip)
	.on("mouseout", tooltip.classed("hidden", true));

    var labelPadding = 2;

    // the component used to render each label               
    var textLabel = fc.layoutTextLabel()
	.padding(labelPadding)
	.value(d => d.label);
    
    // a strategy that combines simulated annealing with removal    
    // of overlapping labels            
    var strategy = fc.layoutRemoveOverlaps(fc.layoutGreedy());
    
    // create the layout that positions the labels                             
    var labels = fc.layoutLabel(strategy)
	.size((_, i, g) => {
            // measure the label and add the required padding          
            var textSize = d3.select(g[i])
		.select('text')
		.node()
		.getBBox();
            return [textSize.width + labelPadding * 2, textSize.height + labelPadding * 2];
	})
	.component(textLabel);
    
  /*  // render labels                                                       
    map.datum(centroids.filter(d => !(isNaN(d.coordinates[0]) || isNaN(d.coordinates[1]))))
	.call(labels.position(d => d.coordinates));
*/

    d3.select("#searchsubmit").on("click", () =>  {
        var word = d3.select("#search").node().value;
	getXMLHttpRequest(queryItem(word) + "&origin=*")
	    .subscribe(r => {
		var item = JSON.parse(r)
		    .results
		    .bindings
		    .map(p => { return p.item.value; })[0];
		
		getXMLHttpRequest(queryTranslations(item) + "&origin=*")
		    .subscribe(response => {
			//clean
			d3.selectAll(".label").remove();
			tooltip.classed("hidden", true);
			d3.selectAll(".messagenotfound").remove();
			
			points = JSON.parse(response)
			    .results
			    .bindings
			    .map(p => {
				return {
				    "coordinates": [parseFloat(p.lon.value), parseFloat(p.lat.value)],
				    "label": p.label.value,
				    "language": p.langLabel.value
				}
			    })
			if (points.length == 0){
			    d3.select("#map")
				.append("text")
				.attr("class", "messagenotfound")
				.attr("x", w/2)
				.attr("y", h/2)
				.html("word not found");
			    d3.select("#map")
				.append("svg:a")
				.attr("class", "messagenotfound")
				.attr("xlink:href", "https://www.wikidata.org/wiki/Special:NewItem")
				.attr("target","_blank")
				.append("rect")
				.attr("class", "messagenotfound")
				.attr("x", (w-150)/2)
				.attr("y", (h+30)/2)
				.attr("height", 30)
				.attr("width", 150)
				.style("fill", "red")
				.attr("rx", 10)
				.attr("ry", 10);
			    d3.select("#map")
				.append("svg:text")
				.attr("class", "messagenotfound")
				.attr("x", w/2)
				.attr("y", h/2)
				.attr("dy", "2em")
				.style("fill", "black")
				.style("text-anchor","middle")
				.style("font-size", "20px")
				.style("pointer-events", "none")
				.text("add to Wikidata");
			} else {    
			    // render labels
			    map.datum(points)
				.call(labels.position(d => projection(d.coordinates)));
			    map.selectAll("rect")
				.on("mouseover", showWordTooltip)
				.on("mouseout", tooltip.classed("hidden", true));
			}
		    });
	    })
		       
    })

    // functions for dragging
    function dragstarted() {
	gpos0 = projection.invert(d3.mouse(this));
	o0 = projection.rotate();
    }
    
    function dragged() {
	gpos1 = projection.invert(d3.mouse(this));
	o0 = projection.rotate();
	o1 = eulerAngles(gpos0, gpos1, o0);
	projection.rotate(o1);

	map.selectAll("path").attr("d", path);
		
	d3.selectAll(".label").remove();
	tooltip.classed("hidden", true);
	map.call(labels.position(d => projection(d.coordinates)));
	map.selectAll("rect")
	    .on("mouseover", showWordTooltip)
	    .on("mouseout", tooltip.classed("hidden", true));
	map.selectAll(".land")
            .on("mouseover", showCountryTooltip)
	    .on("mouseout", tooltip.classed("hidden", true));

    }

    // functions for zooming
    function zoomed() {
	currentScl = d3.event.transform.translate(projection).k * scl;
	projection.scale(currentScl);
	map.selectAll("path").attr("d", path);
	d3.selectAll(".label").remove();
	tooltip.classed("hidden", true);
	
	map.call(labels.position(d => projection(d.coordinates)));
	map.selectAll("rect")
	    .on("mouseover", showWordTooltip)
	    .on("mouseout", tooltip.classed("hidden", true));
	
	map.selectAll(".land")
            .on("mouseover", showCountryTooltip)
	    .on("mouseout", tooltip.classed("hidden", true));
    }
});
