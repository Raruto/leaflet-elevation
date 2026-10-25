/**
 * @see https://github.com/Raruto/leaflet-elevation/issues/211
 *
 * @example
 * ```js
 * L.control.Elevation({ handlers: [ 'Labels' ], labelsRotation: 25, labelsAlign: 'start' })
 * ```
 */
export function Labels() {

  this.on('elechart_updated', function(e) {

    const pointG = this._chart._chart.pane('point');

    const textRotation = this.options.labelsRotation ?? -90;
    const textAnchor = this.options.labelsAlign;

    if (90 == Math.abs(textRotation)) {

      pointG.querySelectorAll('text').forEach(text => L.Control.Elevation.Utils.setAttributes(text, {
        dy: '4px',
        dx: Math.sign(textRotation) * (this._height() - Number(text.parentElement.dataset.y) - 8) + 'px',
        'text-anchor': textRotation > 0 ? 'end' : 'start',
        transform: 'rotate(' + textRotation + ')',
      }));

      pointG.querySelectorAll('circle').forEach(circle => L.Control.Elevation.Utils.setAttributes(circle, {
        r: 2.5, fill: '#fff', stroke: '#000', 'stroke-width': 1.1,
      }));

    } else if (!isNaN(textRotation)) {

      pointG.querySelectorAll('text').forEach(text => L.Control.Elevation.Utils.setAttributes(text, {
        dx: '4px', dy: '-9px',
        'text-anchor': textAnchor ?? (0 == textRotation ? 'start' : 'middle'),
        transform: 'rotate(' + -textRotation + ')',
      }));

    }

  });

	return { };
}
