import { terser } from "rollup-plugin-terser";
import resolve from 'rollup-plugin-node-resolve';
import commonJS from 'rollup-plugin-commonjs';
import postcss from 'rollup-plugin-postcss';
import postcssImport from 'postcss-import';
import postcssCopy from 'postcss-copy';
import rollupGitVersion from 'rollup-plugin-git-version';
import babel from '@rollup/plugin-babel';

let plugin = require('../package.json');
let plugin_name = plugin.name.replace("@raruto/", "");

let input = plugin.module;
let output = {
	file: "dist/" + plugin_name + ".js",
	format: "umd",
	sourcemap: true,
	name: plugin_name,

};

let plugins = [
	resolve(),
	commonJS({
		include: '../node_modules/**'
	}),
	rollupGitVersion(),
	babel({ babelHelpers: 'bundled' }),
];

export default [
	//** "leaflet-elevation.js" **//
	{
		input: input,
		output: output,
		plugins: plugins,
	},

	//** "leaflet-elevation.min.js" **//
	{
		input: input,
		output: Object.assign({}, output, {
			file: "dist/" + plugin_name + ".min.js"
		}),
		plugins: plugins.concat(terser()),
	},

	//** "leaflet-elevation.css" **//
	{
		input: input.replace(".js", ".css"),
		output: {
			file: "dist/" + plugin_name + ".css",
			format: 'es'
		},
		plugins: [
			postcss({
				extract: true,
				inject: false,
				minimize: false,
				plugins: [
					postcssImport({}),
					postcssCopy({
						basePath: 'node_modules',
						dest: "dist",
						template: "images/[path][name].[ext]",
					})
				]
			})
		]
	},

	//** "leaflet-elevation.min.css" **//
	{
		input: input.replace(".js", ".css"),
		output: {
			file: "dist/" + plugin_name + ".min.css",
			format: 'es'
		},
		plugins: [
			postcss({
				extract: true,
				inject: false,
				minimize: true,
				plugins: [
					postcssImport({}),
					postcssCopy({
						basePath: 'node_modules',
						dest: "dist",
						template: "images/[path][name].[ext]",
					})
				]
			})
		]
	},

];
