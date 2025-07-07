import { FeatureCollection, Polygon } from 'geojson';

/**
 * Dissolves a FeatureCollection of {@link Polygon} features, filtered by an optional property name:value.
 * Note that {@link MultiPolygon} features within the collection are not supported
 *
 * @function
 * @param {FeatureCollection<Polygon>} featureCollection input feature collection to be dissolved
 * @param {Object} [options={}] Optional parameters
 * @param {string} [options.propertyName] features with the same `propertyName` value will be dissolved.
 * @returns {FeatureCollection<Polygon>} a FeatureCollection containing the dissolved polygons
 * @example
 * var features = turf.featureCollection([
 *   turf.polygon([[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]], {combine: 'yes'}),
 *   turf.polygon([[[0, -1], [0, 0], [1, 0], [1, -1], [0,-1]]], {combine: 'yes'}),
 *   turf.polygon([[[1,-1],[1, 0], [2, 0], [2, -1], [1, -1]]], {combine: 'no'}),
 * ]);
 *
 * var dissolved = turf.dissolve(features, {propertyName: 'combine'});
 *
 * //addToMap
 * var addToMap = [features, dissolved]
 */
declare function dissolve(fc: FeatureCollection<Polygon>, options?: {
    propertyName?: string;
}): FeatureCollection<Polygon>;

export { dissolve as default, dissolve };
