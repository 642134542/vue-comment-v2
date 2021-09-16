/**
 * Created by PanJiaChen on 16/11/18.
 */

/* eslint-disable */

/**
 * @param {string} path
 * @returns {Boolean}
 */
export function isExternal (path) {
  return /^(https?:|mailto:|tel:)/.test(path)
}

