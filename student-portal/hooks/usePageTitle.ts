import { useEffect } from 'react'

/** Sets the tab title to "<Page> · GrowthTrack". */
export function usePageTitle(title: string) {
  useEffect(() => { document.title = `${title} · GrowthTrack` }, [title])
}
