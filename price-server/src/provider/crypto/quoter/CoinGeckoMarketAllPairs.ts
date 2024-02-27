import fetch from 'lib/fetch'
import { errorHandler } from 'lib/error'
import * as logger from 'lib/logger'
import { num } from 'lib/num'
import { toQueryString } from 'lib/fetch'
import { Quoter } from 'provider/base'
import BigNumber from 'bignumber.js'
import { forEach } from 'lodash'
import { TypeSpecimen } from '@mui/icons-material'

type Response = Record<string, { usd: number }>
interface MarketAll {
  name: string
  base: string
  target: string
  price: number
  volume: number
}

export class CoinGeckoMarketAllPairs extends Quoter {
  private async updatePrices(): Promise<void> {
    const params = {
      vs_currencies: 'usd',
      precision: 18,
      ids: this.symbols.map((symbol) => COIN_GECKO_IDS[symbol]).join(','),
    }

    const response: Response = await fetch(`https://api.coingecko.com/api/v3/simple/price?${toQueryString(params)}`, {
      timeout: this.options.timeout,
    }).then((res) => res.json())

    if (!response) {
      logger.error(`${this.constructor.name}: wrong api response`, response ? JSON.stringify(response) : 'empty')
      throw new Error('Invalid response from Coingecko')
    }

    for (const key of Object.keys(response)) {
      for (const symbol in COIN_GECKO_IDS) {
        if (COIN_GECKO_IDS[symbol] === key) {
          const price = response[key].usd

          this.setPrice(symbol, num(price))
        }
      }
    }
  }
  private async newPriceFixMM(list: MarketAll[]): Promise<number> {
    const marketCapitalization = 239800348 //$239,800,348 USD
    const totalSupply = 8969386191 //8,969,386,191 USTC
    let MMPrice = 0

    // https://medium.com/@cryto2711/a280bd4e94e6
    //case MM f.p =(Market Capitalization/ Total Supply)
    const MMfp = marketCapitalization / totalSupply
    const A = this.FormulaA(list, MMfp)
    if (A > 0) {
      return A
    }

    return 0
  }
  private FormulaA(list: MarketAll[], MMfp: number) {
    let success = false
    let price: number = 0
    // verifica se todos os preçoes seguem a logica
    const onePercent = MMfp * 0.01
    for (let index = 0; index < list.length; index++) {
      const obj = list[index]
      if (MMfp - onePercent <= obj.price && obj.price <= MMfp + onePercent) {
        success = true
      } else {
        success = false
        break
      }
    }
    if (success) {
      price = MMfp
    }
    return price
  }
  private FormulaB(list: MarketAll[], MMfp: number) {
    let success = false
    let success_y = false
    let price: number = 0
    let list_y = new Array()
    // verifica se todos os preçoes seguem a logica

    const onePercent = MMfp * 0.01
    for (let index = 0; index < list.length; index++) {
      const obj = list[index]
      if (MMfp - onePercent <= obj.price && obj.price <= MMfp + onePercent) {
        success = true
      } else {
        list_y.push(obj)
      }
    }
    if (success) {
      for (let index = 0; index < list_y.length; index++) {
        const obj = list_y[index] as MarketAll
        if (obj.price > MMfp + onePercent) {
          success_y = true
        } else {
          success_y = false
          break
        }
      }
    }

    if (success_y) {
      price = this.FormulaBComplement(list, MMfp)
    }
    return price
  }
  private FormulaBComplement(list: MarketAll[], MMfp: number) {
    let price: number = 0
    const sumPrice = list.reduce((accumulator, object) => {
      return accumulator + (object.price - object.volume)
    }, 0)
    const sumVolume = list.reduce((accumulator, object) => {
      return accumulator + object.volume
    }, 0)

    const USTC_CEX_Price = sumPrice / sumVolume
    if ((USTC_CEX_Price - MMfp) / MMfp <= 0.5) {
      price = MMfp - ((USTC_CEX_Price - MMfp) / 2 - MMfp)
    } else {
      price = USTC_CEX_Price * 0.965
    }
    return price
  }
  private FormulaC(list: MarketAll[], MMfp: number) {
    const onePercent = MMfp * 0.01
    let price: number = 0
    let success = false
    for (let index = 0; index < list.length; index++) {
      const obj = list[index]
      if (obj.price > MMfp + onePercent) {
        success = true
      } else {
        success = false
        break
      }
    }
    if (success) {
      price = this.FormulaBComplement(list, MMfp)
    }
    return price
  }
  private FormulaD(list: MarketAll[], MMfp: number) {
    let success = false
    let success_y = false
    let price: number = 0
    let list_y = new Array()
    // verifica se todos os preçoes seguem a logica

    const onePercent = MMfp * 0.01
    for (let index = 0; index < list.length; index++) {
      const obj = list[index]
      if (MMfp - onePercent <= obj.price && obj.price <= MMfp + onePercent) {
        success = true
      } else {
        list_y.push(obj)
      }
    }
    if (success) {
      for (let index = 0; index < list_y.length; index++) {
        const obj = list_y[index] as MarketAll
        if (obj.price < MMfp - onePercent) {
          success_y = true
        } else {
          success_y = false
          break
        }
      }
    }

    if (success_y) {
      price = this.FormulaDComplement(list, MMfp)
    }
    return price
  }

  private FormulaDComplement(list: MarketAll[], MMfp: number) {
    let price: number = 0
    const sumPrice = list.reduce((accumulator, object) => {
      return accumulator + (object.price - object.volume)
    }, 0)
    const sumVolume = list.reduce((accumulator, object) => {
      return accumulator + object.volume
    }, 0)

    const USTC_CEX_Price = sumPrice / sumVolume
    if ((USTC_CEX_Price - MMfp) / MMfp <= 0.5) {
      price = MMfp - ((USTC_CEX_Price - MMfp) / 2 - MMfp)
    } else {
      price = USTC_CEX_Price * 1.035
    }
    return price
  }
  private FormulaE(list: MarketAll[], MMfp: number) {
    const onePercent = MMfp * 0.01
    let price: number = 0
    let success = false
    for (let index = 0; index < list.length; index++) {
      const obj = list[index]
      if (obj.price < MMfp - onePercent) {
        success = true
      } else {
        success = false
        break
      }
    }
    if (success) {
      price = this.FormulaDComplement(list, MMfp)
    }
    return price
  }
  private FormulaF(list: MarketAll[], MMfp: number) {
    let success = false
    let success_y = false
    let price: number = 0
    let list_y = new Array()
    // verifica se todos os preçoes seguem a logica

    const onePercent = MMfp * 0.01
    for (let index = 0; index < list.length; index++) {
      const obj = list[index]
      if (obj.price > MMfp + onePercent) {
        success = true
      } else {
        list_y.push(obj)
      }
    }
    if (success) {
      for (let index = 0; index < list_y.length; index++) {
        const obj = list_y[index] as MarketAll
        if (obj.price < MMfp - onePercent) {
          success_y = true
        } else {
          success_y = false
          break
        }
      }
    }

    if (success_y) {
      const sumPrice = list.reduce((accumulator, object) => {
        return accumulator + (object.price - object.volume)
      }, 0)
      const sumVolume = list.reduce((accumulator, object) => {
        return accumulator + object.volume
      }, 0)

      const USTC_CEX_Price = sumPrice / sumVolume
      if (USTC_CEX_Price - MMfp >= 0) {
        price = this.FormulaBComplement(list, MMfp)
      } else {
        price = this.FormulaDComplement(list, MMfp)
      }
    }
    return price
  }

  protected async update(): Promise<boolean> {
    await this.updatePrices().catch(errorHandler)

    return true
  }
}

const COIN_GECKO_IDS = {
  'BTC/USD': 'bitcoin',
  'ETH/USD': 'ethereum',
  'BNB/USD': 'binancecoin',
  'USDT/USD': 'tether',
  'USDC/USD': 'usd-coin',
  'DAI/USD': 'dai',
  'XRP/USD': 'ripple',
  'DOGE/USD': 'dogecoin',
  'ADA/USD': 'cardano',
  'MATIC/USD': 'matic-network',
  'DOT/USD': 'polkadot',
  'LTC/USD': 'litecoin',
  'STETH/USD': 'staked-ether',
  'OKB/USD': 'okb',
  'SHIB/USD': 'shiba-inu',
  'SOL/USD': 'solana',
  'TRX/USD': 'tron',
  'UNI/USD': 'uniswap',
  'AVAX/USD': 'avalanche-2',
  'LINK/USD': 'chainlink',
  'ETC/USD': 'ethereum-classic',
  'TON/USD': 'the-open-network',
  'XMR/USD': 'monero',
  'XLM/USD': 'stellar',
  'ALGO/USD': 'algorand',
  'QNT/USD': 'quant-network',
  'FIL/USD': 'filecoin',
  'NEAR/USD': 'near',
  'VET/USD': 'vechain',
  'FLOW/USD': 'flow',
  'APE/USD': 'apecoin',
  'ICP/USD': 'internet-computer',
  'EGLD/USD': 'elrond-erd-2',
  'CHZ/USD': 'chiliz',
  'EOS/USD': 'eos',
  'XCN/USD': 'chain-2',
  'XTZ/USD': 'tezos',
  'LDO/USD': 'lido-dao',
  'SAND/USD': 'the-sandbox',
  'THETA/USD': 'theta-token',
  'AAVE/USD': 'aave',
  'AXS/USD': 'axie-infinity',
  'MANA/USD': 'decentraland',
  'MIOTA/USD': 'iota',
  'MKR/USD': 'maker',
  'CAKE/USD': 'pancakeswap-token',
  'APT/USD': 'aptos',
  'XEC/USD': 'ecash',
  'ZEC/USD': 'zcash',
  'KLAY/USD': 'klay-token',
  'GT/USD': 'gatechain-token',
  'NEO/USD': 'neo',
  'AR/USD': 'arweave',
  'DASH/USD': 'dash',
  'FTM/USD': 'fantom',
  'GRT/USD': 'the-graph',
  'SNX/USD': 'havven',
  'MINA/USD': 'mina-protocol',
  'CRV/USD': 'curve-dao-token',
  'NEXO/USD': 'nexo',
  'XRD/USD': 'radix',
  'GMX/USD': 'gmx',
  'BAT/USD': 'basic-attention-token',
  'ZIL/USD': 'zilliqa',
  'ENS/USD': 'ethereum-name-service',
  '1INCH/USD': '1inch',
  'HNT/USD': 'helium',
  'XDC/USD': 'xdce-crowd-sale',
  'FXS/USD': 'frax-share',
  'STX/USD': 'blockstack',
  'CVX/USD': 'convex-finance',
  'ENJ/USD': 'enjincoin',
  'IMX/USD': 'immutable-x',
  'LRC/USD': 'loopring',
  'DCR/USD': 'decred',
  'DFI/USD': 'defichain',
  'TFUEL/USD': 'theta-fuel',
  'AMP/USD': 'amp-token',
  'COMP/USD': 'compound-governance-token',
  'NXM/USD': 'nxm',
  'DYDX/USD': 'dydx',
  'ATOM/USD': 'cosmos',
  'LUNA/USD': 'terra-luna-2',
  'CRO/USD': 'crypto-com-chain',
  'OSMO/USD': 'osmosis',
  'RUNE/USD': 'thorchain',
  'EVMOS/USD': 'evmos',
  'KAVA/USD': 'kava',
  'OKT/USD': 'oec-token',
  'ANKR/USD': 'ankr',
  'KDA/USD': 'kadena',
  'LUNC/USD': 'terra-luna',
  'USTC/USD': 'terrausd',
  'INJ/USD': 'injective-protocol',
  'SCRT/USD': 'secret',
  'JUNO/USD': 'juno-network',
  'STARS/USD': 'stargaze',
  'AKT/USD': 'akash-network',
}

export default CoinGeckoMarketAllPairs
