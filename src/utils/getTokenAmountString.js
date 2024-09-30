export default function getAmountOfTokens(sizeOfTokens) {
  switch (sizeOfTokens) {
    case 100:
      return '100+'
    case 1000:
      return '1k+'
    case 10000:
      return '10k+'
    case 100000:
      return '100k+'
    default:
      return 'All'
  }
}
