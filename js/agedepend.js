//Create a "Div" with an id of "#map-age-depend" in the HTML file - this will be where the map will show up.
//Create a "Div" with an id of "#chart-dock" in the HTML file - this will be where the info chart will shop up when window width small.
var width = 960,
	height = 600,
	margin = {"bottom":45, "left":30, "right":20, "top":20},
	barWidth = 300,
	barHeight = 200,
	windowHeight = window.innerHeight,
	windowWidth = window.innerWidth,
	categories = ["15-24","25-34","35-44","45-54","55-64","65-74","75-84","85+"],
	dockThreshold = 700,
	barPadding = {top:25, left:40, bottom:25, right:20},
	chartHeight = height/4,
	chartDocked,
	chartTotalHeight,
	chartTotalWidth,
	scaleFactor;

var	barSvg = d3.select("#bargraph-age-depend").append("svg")
	.attr("viewBox", "0 0 "+(barWidth+margin.left+margin.right)+" "+(barHeight+margin.bottom+margin.top));

var svgContainer = d3.select("#map-age-depend").append("div")
	.style({"padding-bottom":(height/width*100)+"%", "position":"relative", "width":"100%"})
	.append("svg").attr("class", "svg-ageDepend").style({"position":"absolute", "height":"100%", "width":"100%"})
	.attr("viewBox", "0 0 "+width+" "+height);

var counties = svgContainer.append("g"),
	stateLines = svgContainer.append("g"),
	activeCounties = svgContainer.append("g"),
	bargraph = svgContainer.append("svg").attr("class", "age-depend-chart").style({"pointer-events":"none"}).attr("opacity", 0.0).append("g");

var projection = d3.geo.albersUsa()
	.translate([width/2, (height/2)-margin.bottom])
	.scale(1150);

var path = d3.geo.path().projection(projection);

queue()
	.defer(d3.json, "data/usc1.json")
	.defer(d3.json, "data/states.json")
	.await(ready);

function ready(error, usa, states) {

	var ratioSort = usa.objects.usc.geometries.map(function(entry){
		return entry.properties.pr;
	}).sort(d3.ascending);

	var quantilePercent = d3.range(0,9).map(function(entry){
		return entry*12.5;
	});

	var quantileValue = quantilePercent.map(function(entry){
		return d3.quantile(ratioSort, entry/100);
	});

	var quauntileColor= d3.scale.linear()
	.domain(quantileValue)
	.range(quantilePercent);

	function loadBars(d){
		var data = Object.keys(d.properties).slice(1,9).map(function(entry){
			return d.properties[entry];
		});

		d3.select(".age-depend-chart").transition().duration(500).attr("opacity", 0.85);
		d3.selectAll(".bargraph-row")
			.data(data)
			.transition()
			.duration(600)
			.delay(150)
			.attr("width", function(d){
				return chartX(d);
			});

		d3.select(".county-title").text(d.properties.name+ " County : "+d.properties.pr);
	}

	function swap(county, g){
		g.append(function(){
			return d3.select(county).remove().node();
		});
	}

	function repositionBarChart(){
		var mousePosition= d3.mouse(d3.select("#map-age-depend").node());
		var containerWidth = d3.select("#map-age-depend").node().offsetWidth;
		var left = (mousePosition[0]+chartTotalWidth+15 < containerWidth) ? mousePosition[0]+15 : mousePosition[0] - 15 - chartTotalWidth;
		d3.select(".age-depend-chart").style({"left":left, "top":mousePosition[1]+"px"});
	}

	var timer;

	counties.selectAll(".County")
		.data(topojson.feature(usa, usa.objects.usc).features)
		.enter()
		.append("path")
		.attr("class", function(d){
			var age = d.properties.pr;
			return "County qrt"+(Math.floor(quauntileColor(age)/12.5)+1);
		})
		.attr("d", path)
		.on("mouseover", function(d){
			d3.select(this).classed("hovered",true);

			if (!chartDocked) {
				repositionBarChart();
			}
			//Append county to bottom of DOM to have clean stroke on hover
			swap(this, activeCounties);
			//Delay barchart from showing up unless user hovers half a second
			timer = window.setTimeout(function(){
				loadBars(d);
				}, 500);
		})
		.on("mouseout", function(){
			window.clearTimeout(timer);
			swap(this, counties);
			d3.selectAll(".hovered").classed("hovered",false);
			if(!chartDocked){
				d3.select(".age-depend-chart").attr("opacity", 0.0);
			}
		});
	//Create State Lines
	stateLines.append("path")
		.datum(topojson.mesh(states, states.objects.usstates))
		.attr("class", "State")
		.attr("d", path);

	//Create reference scale
	var	scaleWidth = width / 1.5,
		scaleHeight = 10,
	 	scaleData = quantileValue.map(function(entry, i){
			return Math.round(entry*10)/10+"-"+(Math.round((quantileValue[i+1]*10)-1)/10);
		}).slice(0, 8),
		mapScale = svgContainer.append("g").attr("class", "map-scale").attr("transform", "translate("+(width/2 - scaleWidth/2)+","+(height-(margin.bottom*0.80))+")");

	var	scaleX = d3.scale.ordinal()
			.domain(scaleData)
			.rangeBands([0, scaleWidth], 0.1);

	var	scaleBarWidth = scaleX.rangeBand();

	var scaleXAxis = d3.svg.axis()
		.scale(scaleX);

	d3.select(".map-scale").selectAll("rect")
		.data(scaleData)
		.enter()
		.append("rect")
		.attr("x", function(d){
			return scaleX(d)
		})
		.attr("width", scaleBarWidth)
		.attr("height", scaleHeight)
		.attr("class", function(d,i){
			return "qrt"+(i+1);
		});

	mapScale.append("g").attr("transform", "translate(0,"+scaleHeight+")").call(scaleXAxis);

	//function to recalc variables on window resize and determine Chart status based on window Width
	var calcWindow = function(){
			windowHeight = window.innerHeight,
			windowWidth = window.innerWidth,
			chartDocked = (windowWidth > dockThreshold) ? false : true,
			baseChartWidth = width/3,
			chartTotalHeight = chartHeight+barPadding.top+barPadding.bottom,
			chartTotalWidth = baseChartWidth+barPadding.right+barPadding.left,
			svgWidth = (!chartDocked) ? chartTotalWidth : windowWidth,
			scaleFactor = windowWidth/chartTotalWidth;

			console.log("windowWidth: "+windowWidth+", scaleFactor: "+scaleFactor+", chartWidth: "+svgWidth);

			d3.select(".age-depend-chart").attr("height", chartTotalHeight).attr("width", svgWidth);

			if (chartDocked) {
				d3.select(".age-depend-chart").classed("undocked", false);
				d3.select(".age-depend-chart").style({"left":0, "top":0});
				bargraph.attr("transform", "scale("+scaleFactor+",1)");
				$(".age-depend-chart").appendTo("#chart-dock");
			} else {
				d3.select(".age-depend-chart").classed("undocked", true);
				bargraph.attr("transform", "scale(1,1)");
				$(".age-depend-chart").appendTo("#map-age-depend div");
			}

	};

	calcWindow();

	//create chart variables

	var chartX = d3.scale.linear()
		.domain([0, 32])
		.range([0, baseChartWidth]);

	var chartY = d3.scale.ordinal()
		.domain(categories)
		.rangeBands([0, chartHeight], 0.1);

	var xAxis = d3.svg.axis()
		.scale(chartX);

	var yAxis = d3.svg.axis()
		.scale(chartY)
		.orient("left");

	//create chart background
	bargraph.append("rect")
		.attr("width", chartTotalWidth)
		.attr("height", chartTotalHeight)
		.attr("fill", "#EAEAEA");
	//create chart axis
	bargraph.append("g").attr("transform", "translate("+barPadding.left+","+barPadding.top+")").attr("class", "axis top-axis").call(xAxis.orient("top"))
	bargraph.append("g").attr("transform", "translate("+barPadding.left+","+(barPadding.top+chartHeight)+")").attr("class", "axis").call(xAxis.orient("bottom"));
	bargraph.append("g").attr("transform", "translate("+barPadding.left+","+barPadding.top+")").attr("class", "axis").call(yAxis);

	//create chart title
	bargraph.append("text")
		.attr("x", chartTotalWidth/2)
		.attr("text-anchor", "middle")
		.attr("y", 18).text("Select a County")
		.attr("class", "county-title");

	//create chart bar rows
	bargraph.selectAll(".bargraph-row")
	.data(categories)
	.enter()
	.append("rect")
	.attr("class", "bargraph-row")
	.attr("height", chartY.rangeBand())
	.attr("width", function(d){
		return 0;
	})
	.attr("x", barPadding.left)
	.attr("y", function(d, i){
		return chartY(d)+barPadding.top;
	})
	.attr("fill", function(d,i){
		if (i < 5){
			return "#0571b1";
		} else {
			return "#c90020";}
	});


	window.addEventListener("resize", calcWindow);



};
