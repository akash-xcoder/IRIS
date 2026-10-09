import { useEffect, useRef, useState } from 'react'
import { loadMaps } from '../navigation/route'

export interface MapPoint {
  id: string
  name: string
  lat: number
  lng: number
  accuracy: number | null
  /** Red while the person needs help. */
  alert: boolean
}

/**
 * Where each person is, on a Google map that follows them as their position updates. When the map
 * can't load (no key, offline), the caller's list of links still shows where everyone is.
 */
export function LiveMap({ points }: { points: MapPoint[] }) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<google.maps.Map | null>(null)
  const markers = useRef(new Map<string, { marker: google.maps.Marker; circle: google.maps.Circle }>())
  const framed = useRef('')
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let stale = false
    loadMaps()
      .then(async () => {
        if (stale || !el.current || !window.google?.maps?.importLibrary) return setFailed(!stale)
        const { Map } = (await google.maps.importLibrary('maps')) as google.maps.MapsLibrary
        if (stale || !el.current) return
        map.current = new Map(el.current, {
          center: { lat: 20.6, lng: 78.9 },
          zoom: 5,
          disableDefaultUI: true,
          zoomControl: true,
          fullscreenControl: true,
          clickableIcons: false,
        })
        setReady(true)
      })
      .catch(() => !stale && setFailed(true))
    return () => {
      stale = true
    }
  }, [])

  // Add, move and remove markers as positions change; reframe only when the set of people changes.
  useEffect(() => {
    const m = map.current
    if (!ready || !m) return
    const seen = new Set<string>()
    for (const p of points) {
      seen.add(p.id)
      const position = { lat: p.lat, lng: p.lng }
      const color = p.alert ? '#d93025' : '#1a73e8'
      const icon = { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: color, fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 3 }
      const existing = markers.current.get(p.id)
      if (existing) {
        existing.marker.setPosition(position)
        existing.marker.setIcon(icon)
        existing.circle.setCenter(position)
        existing.circle.setRadius(p.accuracy ?? 0)
      } else {
        markers.current.set(p.id, {
          marker: new google.maps.Marker({ map: m, position, icon, title: p.name, label: { text: p.name.slice(0, 1).toUpperCase(), color: '#ffffff', fontWeight: '700' } }),
          circle: new google.maps.Circle({ map: m, center: position, radius: p.accuracy ?? 0, strokeOpacity: 0, fillColor: color, fillOpacity: 0.15, clickable: false }),
        })
      }
    }
    for (const [id, { marker, circle }] of markers.current) {
      if (seen.has(id)) continue
      marker.setMap(null)
      circle.setMap(null)
      markers.current.delete(id)
    }

    const key = points.map((p) => p.id).sort().join()
    if (key === framed.current || !points.length) return
    framed.current = key
    if (points.length === 1) {
      m.setCenter({ lat: points[0].lat, lng: points[0].lng })
      m.setZoom(17)
    } else {
      const bounds = new google.maps.LatLngBounds()
      points.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }))
      m.fitBounds(bounds, 48)
    }
  }, [points, ready])

  if (failed) return null
  return <div ref={el} className="live-map" role="region" aria-label="Map of where your family members are" />
}
