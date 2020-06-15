import * as _ from './utils';

export var Options = {
	autohide: !L.Browser.mobile,
	autohideMarker: true,
	collapsed: false,
	detached: true,
	distanceFactor: 1,
	dragging: !L.Browser.mobile,
	downloadLink: 'link',
	elevationDiv: "#elevation-div",
	followMarker: true,
	forceAxisBounds: false,
	gpxOptions: {
		async: true,
		marker_options: {
			startIconUrl: null,
			endIconUrl: null,
			shadowUrl: null,
			wptIcons: {
				'': L.divIcon({
					className: 'elevation-waypoint-marker',
					html: '<i class="elevation-waypoint-icon"></i>',
					iconSize: [30, 30],
					iconAnchor: [8, 30],
				})
			},
		},
	},
	height: 200,
	heightFactor: 1,
	hoverNumber: {
		decimalsX: 2,
		decimalsY: 0,
		formatter: _.formatter,
	},
	imperial: false,
	interpolation: "curveLinear",
	lazyLoadJS: true,
	legend: true,
	loadData: {
		defer: false,
		lazy: false,
	},
	marker: 'elevation-line',
	markerIcon: L.divIcon({
		className: 'elevation-position-marker',
		html: '<i class="elevation-position-icon"></i>',
		iconSize: [32, 32],
		iconAnchor: [16, 16],
	}),
	placeholder: false,
	position: "topright",
	polyline: {
		className: 'elevation-polyline',
		color: '#000',
		opacity: 0.75,
		weight: 5,
		lineCap: 'round'
	},
	reverseCoords: false,
	skipNullZCoords: false,
	theme: "lightblue-theme",
	margins: {
		top: 10,
		right: 20,
		bottom: 30,
		left: 50
	},
	responsive: true,
	summary: 'inline',
	slope: false,
	width: 600,
	xAttr: "dist",
	xLabel: "km",
	xTicks: undefined,
	yAttr: "z",
	yAxisMax: undefined,
	yAxisMin: undefined,
	yLabel: "m",
	yTicks: undefined,
	zFollow: 13,
};
