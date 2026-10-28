/**
 * Animate a track with requestAnimationFrame; motion speed is in km/h and duration in ms.
 * 
 * Inspired by: https://github.com/Igor-Vladyka/leaflet.motion
 *
 * @example
 * ```js
 * L.control.Elevation({ handlers: [ 'Runner' ], runnerOptions: { polyline: {..}, motion: {..}, marker {..} } })
 * ```
 */
export function Runner() {

  const _ = L.Control.Elevation.Utils;

  let { runnerOptions } = this.options;

  runnerOptions = Object.assign(
    { polyline: {}, motion: {}, marker: undefined },
    'object' === typeof runnerOptions ? runnerOptions : {}
  );

  // Custom tooltips
  this._registerTooltip({
    name: 'here',
    marker: (item) => L._("You are here: "),
    order: 1,
  });

  this._registerTooltip({
    name: 'distance',
    marker: (item) => Math.round(item.dist) + " " + this.options.xLabel,
    order: 2,
  });

  this.addCheckpoint = function (checkpoint) {
    return this._registerCheckPoint({ // <-- NB these are private functions use them at your own risk!
      latlng: this._findItemForX(this._x(checkpoint.dist)).latlng,
      label: checkpoint.label || ''
    });
  }

  this.addRunner = function (runner) {
    let x = this._x(runner.dist);
    let y = this._y(this._findItemForX(x).z)
    let g = _.create('svg:circle', '', {
      class: "runner " + this.options.theme + " height-focus circle-lower",
      r: 6, cx: x, cy: y,
    }, this._container.querySelector('svg > g'));
    return g;
  }

  this.setPositionFromLatLng = function (latlng) {
    this._onMouseMoveLayer({ latlng: latlng }); // Update map and chart "markers" from latlng
  };

  this.tick = function (runner, dist = 0, inc = 0.1) {
    dist = (dist <= this.track_info.distance - inc) ? dist + inc : 0;
    this.updateRunnerPos(runner, dist);
    setTimeout(() => this.tick(runner, dist), 150);
  };

  this.updateRunnerPos = function (runner, pos) {
    let curr, x;

    if (pos instanceof L.LatLng) {
      curr = this._findItemForLatLng(pos);
      x = this._x(curr.dist);
    } else {
      x    = this._x(pos);
      curr = this._findItemForX(x);
    }

    runner.setAttribute("cx", x);
    runner.setAttribute("cy", this._y(curr.z));
    this.setPositionFromLatLng(curr.latlng);
  };

  this.animate = function (layer, speed = 1500) {
    const latlngs = [];
    const collect = segment => {
      if (segment instanceof L.Polyline) {
        const append = points => {
          if (L.LineUtil.isFlat(points)) latlngs.push(...points);
          else points.forEach(append);
        };
        append(segment.getLatLngs());
      } else if (segment.eachLayer) segment.eachLayer(collect);
    };
    collect(layer);
    if (!latlngs.length) throw new Error('The runner requires a track with coordinates.');

    const distances = [0];
    for (let i = 1; i < latlngs.length; i++) {
      distances.push(distances[i - 1] + latlngs[i - 1].distanceTo(latlngs[i]));
    }
    const length = distances[distances.length - 1];
    const motion = Object.assign({ auto: true, speed, easing: value => value }, runnerOptions.motion);
    const duration = motion.duration || (motion.speed ? length / motion.speed * 3600 : 0);
    if (!Number.isFinite(duration) || duration < 0 || !Number.isFinite(motion.speed) || motion.speed < 0) {
      throw new Error('Runner speed and duration must be finite, non-negative numbers.');
    }
    if (typeof motion.easing !== 'function') throw new Error('Runner easing must be a function.');

    if (this._runner) {
      this._runner.remove();
    }

    layer.setStyle({ opacity: 0.5 });

    const runner = this._runner = new L.Polyline([], Object.assign(
      { color: 'red', pane: 'elevationPane', attribution: '' }, runnerOptions.polyline
    ));
    const marker = runnerOptions.marker ? new L.Marker(latlngs[0], runnerOptions.marker) : null;
    let circle;
    let frame;
    let started;
    let elapsed = 0;
    let running = false;

    const draw = progress => {
      const distance = length * progress;
      let index = 1;
      while (index < distances.length - 1 && distances[index] < distance) index++;
      index = Math.min(index, latlngs.length - 1);
      const previous = Math.max(0, index - 1);
      const segmentLength = distances[index] - distances[previous];
      const ratio = segmentLength ? (distance - distances[previous]) / segmentLength : 0;
      const from = this._map.project(latlngs[previous]);
      const to = this._map.project(latlngs[index]);
      const position = this._map.unproject(from.add(to.subtract(from).multiplyBy(ratio)));
      runner.setLatLngs([...latlngs.slice(0, index), position]);
      circle = circle || this.addRunner({ dist: 0 });
      this.updateRunnerPos(circle, position);
      if (marker) marker.setLatLng(position).addTo(this._map);
    };
    const advance = timestamp => {
      started = started ?? timestamp - elapsed;
      elapsed = timestamp - started;
      const progress = duration ? Math.min(1, elapsed / duration) : 1;
      draw(progress === 1 ? 1 : Math.max(0, Math.min(1, motion.easing(progress, elapsed, 0, 1, duration))));
      if (progress < 1) frame = requestAnimationFrame(advance);
      else {
        running = false;
        if (runnerOptions.marker?.removeOnEnd) marker.remove();
        runner.fire('motion-ended', { layer: runner });
      }
    };
    runner.motionPause = () => {
      cancelAnimationFrame(frame);
      running = false;
      started = undefined;
      return runner;
    };
    runner.motionResume = () => {
      if (!running && runner._map) {
        running = true;
        frame = requestAnimationFrame(advance);
      }
      return runner;
    };
    runner.motionStart = () => {
      runner.motionPause();
      elapsed = 0;
      return runner.motionResume();
    };
    runner.getMarker = () => marker;
    runner.on('remove', () => {
      runner.motionPause();
      circle?.remove();
      marker?.remove();
      this.off('eledata_clear', remove);
      this.off('remove', remove);
    });
    const remove = () => runner.remove();
    this.on('eledata_clear', remove);
    this.on('remove', remove);
    runner.addTo(this._map);
    if (motion.auto) runner.motionStart();
  };

  return {};
}
