import 'leaflet-i18n';
import * as _ from './utils';
import * as D3 from './components';
import { Elevation } from './control';

Elevation.addInitHook(function () {
	if (!this.options.speed) return;
    var opts = this.options;
    var speed = {};
    opts.margins.right = 50;

    if (this.options.speed != "summary") {
		this.on("elechart_init", function () {
			speed.path = this._chart._area.append('path').style("pointer-events", "none") // TODO: add a class here.
				.attr("fill", "#03ffff").attr("stroke", "#000").attr("stroke-opacity", "0.5").attr("fill-opacity", "0.25");
		});
			
		this.on("elechart_axis", function () {
			speed.x = this._chart._x; 
			  
			speed.y = Scale({
				data: this._data,
				range: [this._height(), 0],
				attr: "speed",
				min: 0,
				max: +1,
				forceBounds: opts.forceAxisBounds
			});
			  
			speed.axis = Axis({
				axis: "y",
				position: "right",
				width: this._width(),
				height: this._height(),
				scale: speed.y,
				ticks: this.options.yTicks,
				tickPadding: 36,
				label: "km/h",
				labelX: 50,
				labelY: 3
			});

			this._chart._axis.call(speed.axis);
		});
			
		this.on("elechart_updated", function () {
			speed.area = Area({
				interpolation: opts.sInterpolation,
				data: this._data,
				name: 'speed',
				xAttr: opts.xAttr,
				yAttr: "speed",
				width: this._width(),
				height: this._height(),
				scaleX: speed.x,
				scaleY: speed.y
			});
			speed.path.call(speed.area);	  
		});
			
		this.on("elechart_legend", function () {
			speed.legend = this._chart._legend.append("g").call(LegendItem({
				name: 'speed',
				width: this._width(),
				height: this._height(),
				margins: this.options.margins
			}));

			this._altitudeLegend.attr("transform", "translate(-100, 0)");
			this._slopeLegend.attr("transform", "translate(0, 0)");
			speed.legend.attr("transform", "translate(100, 0)");
			speed.legend.select("rect").classed("area", false) // TODO: add a class here.
				.attr("fill", "#03ffff").attr("stroke", "#000").attr("stroke-opacity", "0.5").attr("fill-opacity", "0.25");
		});
	}
	
	this.on('elepoint_added', function(e) {
		if (e.point.meta) {
			//this._data[e.index].t = e.point.meta.time; // if not time hook
			var z = this._data[e.index].z;
			var curr = this._data[e.index].latlng;
			var currtime = +this._data[e.index].t /1000;
			var prev = e.index > 0 ? this._data[e.index-1].latlng : curr;
			var prevtime = e.index > 0 ? +this._data[e.index-1].t/1000 : currtime;
			var delta = curr.distanceTo(prev) * this._distanceFactor; 
			var deltatime = currtime - prevtime;
			var speed = 0;
			if (!isNaN(z)) {
				//TODO add Summary: Speed Average && Max
				speed = (delta > 0 && deltatime > 0) ? ( delta / deltatime )*3.6 : 0;
				if (this.options.sLimit) {
					var sLimit = this.options.sLimit;
					speed = (sLimit) ? ((sLimit > speed) ? speed : sLimit) : speed;
				}	
			} 
			speed = L.Util.formatNum(speed,2);
			this._data[e.index].speed = speed;
		}
	});
	  
    this.on("elechart_change", function (e) {
        var item = e.data;
        var chart = this._chart;
        var marker = this._marker;

		if (chart._focuslabel) {
			if (!chart._focuslabelSpeed || !chart._focuslabelSpeed.property('isConnected')) {
				chart._focuslabelSpeed = chart._focuslabel.select('text').insert("svg:tspan", ".mouse-focus-label-x").attr("class", "mouse-focus-label-speed").attr("dy", "1.5em");
			}
			chart._focuslabelSpeed.text(item.speed + " " + L._("km/h"));
			chart._focuslabel.select('.mouse-focus-label-x').attr("dy", "1.5em");
        }

        if (marker._focuslabel) {
			if (!chart._mouseSpeedFocusLabel) {
				chart._mouseSpeedFocusLabel = marker._focuslabel.append("svg:tspan").attr("class", "height-focus-speed ");
			}
			chart._mouseSpeedFocusLabel.attr("dy", "1.5em").text(Math.round(item.speed) + " " + L._("km/h"));
			marker._focuslabel.select('.height-focus-y').attr("dy", "-1.5em");
		  
        }		
    });
});
