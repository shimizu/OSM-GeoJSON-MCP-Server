import { Feature, Point, Position, Polygon, MultiPolygon } from 'geojson';
import { Units } from '@turf/helpers';

/**
 * Calculates the distance from a point to the edges of a polygon or multi-polygon.
 * Returns negative values for points inside the polygon.
 * Handles polygons with holes and multi-polygons.
 * A hole is treated as the exterior of the polygon.
 *
 * @param {Feature<Point> | Point | Position} point Input point
 * @param {Feature<Polygon | MultiPolygon> | Polygon | MultiPolygon} polygonOrMultiPolygon Input polygon or multipolygon
 * @param {Object} options Optional parameters
 * @param {Units} options.units Units of the result e.g. "kilometers", "miles", "meters"
 * @param {"geodesic" | "planar"} options.method Method of the result
 * @returns {number} Distance in meters (negative values for points inside the polygon)
 * @throws {Error} If input geometries are invalid
 */
declare function pointToPolygonDistance(point: Feature<Point> | Point | Position, polygonOrMultiPolygon: Feature<Polygon | MultiPolygon> | Polygon | MultiPolygon, options?: {
    units?: Units;
    method?: "geodesic" | "planar";
}): number;

export { pointToPolygonDistance as default, pointToPolygonDistance };
