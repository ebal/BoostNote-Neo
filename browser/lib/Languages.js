const languages = [
  {
    name: 'English',
    locale: 'en'
  }
]

module.exports = {
  getLocales() {
    return languages.reduce(function (localeList, locale) {
      localeList.push(locale.locale)
      return localeList
    }, [])
  },
  getLanguages() {
    return languages
  }
}
