/*
 * ISC License (ISC)
 * Copyright (c) 2018 aeternity developers
 *
 *  Permission to use, copy, modify, and/or distribute this software for any
 *  purpose with or without fee is hereby granted, provided that the above
 *  copyright notice and this permission notice appear in all copies.
 *
 *  THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
 *  REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
 *  AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
 *  INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
 *  LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
 *  OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
 *  PERFORMANCE OF THIS SOFTWARE.
 */
const { expect } = require( 'chai' )
import { BigNumber } from 'ethers'
//const MINIMUM_LIQUIDITY = BigInt( BigNumber.from( 10 ).pow( 3 ) )

const { defaultWallets: WALLETS } = require( '../config/wallets.json' )

import {
    getA,
    pairFixture,
    beforeEachWithSnapshot,
} from './shared/fixtures'

import {
    expandTo18Decimals,
    expectToRevert,
    encodePrice,
    MINIMUM_LIQUIDITY,
} from './shared/utilities'

const wallet = {
    ...WALLETS[0],
    address: WALLETS[0].publicKey
}

const other = {
    ...WALLETS[1],
    address: WALLETS[1].publicKey
}
var token0, token1, pair, callee, factory

describe( 'Pair Factory', () => {
    beforeEachWithSnapshot( 'first compile pool factory', async () => {
        ( { token0, token1, pair, callee, factory } = await pairFixture() )
    } )
    const pairAddress = () => getA( pair ).replace( "ct_", "ak_" )

    //------------------------------------------------------------------------------
    // entrypoint wrappers
    //------------------------------------------------------------------------------

    const totalSupply = ( isToken0 ) => {
        const token = isToken0 ? token0 : token1
        console.debug( `token${isToken0 ? 0 : 1}.total_supply()` )

        return token.exe( x => x.total_supply( ) )
    }

    const token0TotalSupply = ( address ) => totalSupply( true, address )
    const token1TotalSupply = ( address ) => totalSupply( false, address )

    const balance = ( isToken0, address ) => {
        const token = isToken0 ? token0 : token1
        console.debug( `token${isToken0 ? 0 : 1}.balance( ${address})` )
        return token.exe( x => x.balance( address ) )
    }

    const token0Balance = ( address ) => balance( true, address )
    const token1Balance = ( address ) => balance( false, address )

    const transfer = async ( isToken0, amount ) => {
        const token = isToken0 ? token0 : token1
        console.debug( `token${isToken0 ? 0 : 1}.transfer( ${pairAddress()}, ${amount.toString()})` )
        await token.exe( x => x.transfer( pairAddress(), BigInt( amount ) ) )
    }
    const token0Transfer = ( amount ) => transfer( true, amount.toString() )
    const token1Transfer = ( amount ) => transfer( false, amount.toString() )

    const pairTransfer = async ( amount ) => {
        console.debug( `pair.transfer( ${pairAddress()}, ${amount.toString()})` )
        await pair.exe( x => x.transfer( pairAddress(), amount.toString() ) )
    }
    const pairBurn = async ( address ) => {
        console.debug( `pair.burn( ${address})` )
        await pair.exe( x => x.burn( address,  { gas: 100000 }  ) )
    }

    const mint = async ( address ) => {
        console.debug( `pair.mint( ${address} )` )
        await pair.exe( x => x.mint( address,  { gas: 100000 } ) )
    }
    const swap = async ( amount0, amount1, address ) => {
        const calleeAddress = getA( callee )
        console.debug( `pair.swap( ${amount0.toString()}, ${amount1.toString()}, ${address}, ${calleeAddress} )` )
        await pair.exe( x => x.swap(
            amount0.toString(),
            amount1.toString(),
            address,
            calleeAddress,
            { gas: 100000 }
        ) )
    }
    const pairBalance = ( address ) => {
        console.debug( `pair.balance( ${address})` )
        return pair.exe( x => x.balance( address ) )
    }
    const getReserves = async () => {
        console.debug( `pair.get_reserves()` )
        return await pair.exe( x => x.get_reserves() )
    }
    const pairTotalSupply = ( ) => {
        console.debug( `pair.total_supply()` )
        return pair.exe( x => x.total_supply( ) )
    }
    const  setDebugTime = ( offset ) => {
        console.debug( `pair.set_debug_time(${offset})` )
        return pair.exe( x => x.set_debug_time( offset ) )
    }
    const  sync = ( ) => {
        console.debug( `pair.sync()` )
        return pair.exe( x => x.sync( { gas: 100000 } ) )
    }
    const  price0CumulativeLastStr = ( ) => {
        console.debug( `pair.price0_cumulative_last_str()` )
        return pair.exe( x => x.price0_cumulative_last_str( ) )
    }
    const  price1CumulativeLastStr = ( ) => {
        console.debug( `pair.price1_cumulative_last_str()` )
        return pair.exe( x => x.price1_cumulative_last_str( ) )
    }
    const setFeeTo = async ( address ) => {
        console.debug( `factory.set_fee_to( ${address})` )
        await factory.exe( x => x.set_fee_to( address ) )
    }

    //------------------------------------------------------------------------------
    // entrypoint wrappers
    //------------------------------------------------------------------------------

    it( 'mint', async () => {
        const token0Amount = expandTo18Decimals( 1 )
        const token1Amount = expandTo18Decimals( 4 )
        await token0Transfer( token0Amount )
        await token1Transfer( token1Amount )

        const expectedLiquidity = BigInt( expandTo18Decimals( 2 ) )
        await mint( wallet.address )

        expect(
            await pairTotalSupply()
        ).to.eq( expectedLiquidity )
        expect(
            await pairBalance( wallet.address )
        ).to.eq( expectedLiquidity - MINIMUM_LIQUIDITY )

        expect(
            await token0Balance( pairAddress() )
        ).to.eq( BigInt( token0Amount ) )
        expect(
            await token1Balance( pairAddress() )
        ).to.eq( BigInt( token1Amount ) )

        const reserves = await getReserves()
        expect( reserves.reserve0 ).to.eq( BigInt( token0Amount ) )
        expect( reserves.reserve1 ).to.eq( BigInt( token1Amount ) )
    } )

    async function addLiquidity( token0Amount, token1Amount ) {
        await token0Transfer( token0Amount.toString() )
        await token1Transfer( token1Amount.toString() )
        await mint( wallet.address )
    }
    const swapTestCases = [
        [ 1, 5, 10,     '1662497915624478906' ],
        [ 1, 10, 5,      '453305446940074565' ],

        [ 2, 5, 10,     '2851015155847869602' ],
        [ 2, 10, 5,      '831248957812239453' ],

        [ 1, 10, 10,     '906610893880149131' ],
        [ 1, 100, 100,   '987158034397061298' ],
        [ 1, 1000, 1000, '996006981039903216' ]
    ].map( a => a.map( n => (
        typeof n === 'string' ? BigNumber.from( n ) : expandTo18Decimals( n )
    ) ) )
    swapTestCases.forEach( ( swapTestCase, i ) => {
        it( `getInputPrice:${i}`, async () => {
            const [
                swapAmount,
                token0Amount,
                token1Amount,
                expectedOutputAmount,
            ] = swapTestCase

            await addLiquidity( token0Amount, token1Amount )
            await token0Transfer( swapAmount )

            await expectToRevert(
                () => swap(
                    0,
                    expectedOutputAmount.add( 1 ),
                    wallet.address,
                ),
                'INSUFFICIENT_BALANCE'
            )
            await swap(
                0,
                expectedOutputAmount,
                wallet.address,
            )
        } )
    } )

    const optimisticTestCases = [
        [ '997000000000000000', 5, 10, 1 ], // given amountIn, amountOut = floor(amountIn * .997)
        [ '997000000000000000', 10, 5, 1 ],
        [ '997000000000000000', 5, 5, 1 ],
        [ 1, 5, 5, '1003009027081243732' ] // given amountOut, amountIn = ceiling(amountOut / .997)
    ].map( a => a.map( n =>
        ( typeof n === 'string'
            ? BigNumber.from( n )
            : expandTo18Decimals( n )
        ) ) )
    optimisticTestCases.forEach( ( optimisticTestCase, i ) => {
        it( `optimistic:${i}`, async () => {
            const calleeAddress = getA( callee )
            const [
                outputAmount,
                token0Amount,
                token1Amount,
                inputAmount
            ] = optimisticTestCase
            await addLiquidity( token0Amount, token1Amount )
            await token0Transfer( inputAmount )
            console.debug( `swap( ${outputAmount.add( 1 ).toString()}, 0, ${wallet.address}, ${calleeAddress},) ` )
            await expectToRevert(
                () => swap(
                    outputAmount.add( 1 ),
                    0,
                    wallet.address,
                ),
                'INSUFFICIENT_BALANCE'
            )
            await swap(
                outputAmount,
                0,
                wallet.address,
            )
        } )
    } )

    it( 'swap:token0', async () => {
        const token0Amount = expandTo18Decimals( 5 )
        const token1Amount = expandTo18Decimals( 10 )
        await addLiquidity( token0Amount, token1Amount )

        const swapAmount = expandTo18Decimals( 1 )
        const expectedOutputAmount = BigNumber.from( '1662497915624478906' )
        await token0Transfer( swapAmount )
        await swap( 0, expectedOutputAmount, wallet.address )

        const reserves = await getReserves()
        expect( reserves.reserve0 ).to.eq( BigInt( token0Amount ) + BigInt( swapAmount ) )
        expect( reserves.reserve1 ).to.eq( BigInt( token1Amount ) - BigInt( expectedOutputAmount ) )

        expect( await token0Balance( pairAddress() ) )
            .to.eq( BigInt( token0Amount ) + BigInt( swapAmount ) )
        expect( await token1Balance( pairAddress() ) )
            .to.eq( BigInt( token1Amount ) - BigInt( expectedOutputAmount ) )

        const totalSupplyToken0 = await token0TotalSupply()
        const totalSupplyToken1 = await token1TotalSupply()

        expect( await token0Balance( wallet.address ) )
            .to.eq(
                totalSupplyToken0  -
                BigInt( token0Amount ) -
                BigInt( swapAmount )
            )
        expect( await token1Balance( wallet.address ) )
            .to.eq( totalSupplyToken1 -
                BigInt( token1Amount ) +
                BigInt( expectedOutputAmount )
            )
    } )

    it( 'swap:token1', async () => {
        const token0Amount = expandTo18Decimals( 5 )
        const token1Amount = expandTo18Decimals( 10 )
        await addLiquidity( token0Amount, token1Amount )

        const swapAmount = expandTo18Decimals( 1 )
        const expectedOutputAmount = BigNumber.from( '453305446940074565' )
        await token1Transfer(  swapAmount )
        await swap( expectedOutputAmount, 0, wallet.address )

        const reserves = await getReserves()
        expect( reserves.reserve0 ).to.eq(
            BigInt( token0Amount ) - BigInt( expectedOutputAmount )
        )
        expect( reserves.reserve1 ).to.eq(
            BigInt( token1Amount ) + BigInt( swapAmount )
        )

        expect( await token0Balance( pairAddress() ) )
            .to.eq( BigInt( token0Amount.sub( expectedOutputAmount ) ) )
        expect( await token1Balance( pairAddress() ) )
            .to.eq( BigInt( token1Amount.add( swapAmount ) ) )

        const totalSupplyToken0 = await token0TotalSupply()
        const totalSupplyToken1 = await token1TotalSupply()
        expect( await token0Balance( wallet.address ) )
            .to.eq( totalSupplyToken0 
                - BigInt( token0Amount )
                + BigInt( expectedOutputAmount )
            )
        expect( await token1Balance( wallet.address ) )
            .to.eq( totalSupplyToken1 - BigInt( token1Amount )
                - BigInt( swapAmount )
            )
    } )
    it( 'burn', async () => {
        const token0Amount = expandTo18Decimals( 3 )
        const token1Amount = expandTo18Decimals( 3 )
        await addLiquidity( token0Amount, token1Amount )

        const expectedLiquidity = expandTo18Decimals( 3 )

        await pairTransfer( expectedLiquidity.sub( MINIMUM_LIQUIDITY ) )

        await pairBurn( wallet.address )

        expect( await pairBalance( wallet.address ) ).to.eq( 0n )
        expect( await pairTotalSupply() ).to.eq( MINIMUM_LIQUIDITY )
        expect( await token0Balance( pairAddress() ) ).to.eq( 1000n )
        expect( await token1Balance( pairAddress() ) ).to.eq( 1000n )
        const totalSupplyToken0 = await token0TotalSupply()
        const totalSupplyToken1 = await token1TotalSupply()
        expect(
            await token0Balance( wallet.address )
        ).to.eq( totalSupplyToken0 - 1000n )
        expect(
            await token1Balance( wallet.address )
        ).to.eq( totalSupplyToken1 - 1000n )
    } )
    it( 'price{0,1}CumulativeLast', async () => {
        const token0Amount = expandTo18Decimals( 3 )
        const token1Amount = expandTo18Decimals( 3 )
        const initialPrice = encodePrice( token0Amount, token1Amount )

        await addLiquidity( token0Amount, token1Amount )

        const { block_timestamp_last: blockTimestamp } = await getReserves()
        await setDebugTime( blockTimestamp + 1n )
        await sync( )

        expect( await price0CumulativeLastStr() )
            .to.eq( initialPrice[0].toString() )
        expect( await price1CumulativeLastStr() )
            .to.eq( initialPrice[1].toString() )
        expect( ( await getReserves() ).block_timestamp_last )
            .to.eq( blockTimestamp + 1n )

        const swapAmount = expandTo18Decimals( 3 )
        await token0Transfer( swapAmount )
        await setDebugTime( blockTimestamp + 10n )

        // swap to a new price eagerly instead of syncing
        await swap( 0, expandTo18Decimals( 1 ), wallet.address )

        expect( await price0CumulativeLastStr() )
            .to.eq( initialPrice[0].mul( 10 ).toString() )
        expect( await price1CumulativeLastStr() )
            .to.eq( initialPrice[1].mul( 10 ).toString() )
        expect( ( await getReserves() ).block_timestamp_last )
            .to.eq( blockTimestamp + 10n )

        await setDebugTime( blockTimestamp + 20n )
        await sync( )

        const newPrice = encodePrice(
            expandTo18Decimals( 6 ),
            expandTo18Decimals( 2 )
        )
        expect( await price0CumulativeLastStr() )
            .to.eq(
                initialPrice[0]
                    .mul( 10 )
                    .add( newPrice[0].mul( 10 ) )
                    .toString()
            )
        expect( await price1CumulativeLastStr() )
            .to.eq(
                initialPrice[1]
                    .mul( 10 )
                    .add( newPrice[1].mul( 10 ) )
                    .toString()
            )
        expect( ( await getReserves() ).block_timestamp_last )
            .to.eq( blockTimestamp + 20n )
    } )
    it( 'feeTo:off', async () => {
        const token0Amount = expandTo18Decimals( 1000 )
        const token1Amount = expandTo18Decimals( 1000 )
        await addLiquidity( token0Amount, token1Amount )

        const swapAmount = expandTo18Decimals( 1 )
        const expectedOutputAmount = BigNumber.from( '996006981039903216' )
        await token1Transfer( swapAmount )
        await swap( expectedOutputAmount, 0, wallet.address )

        const expectedLiquidity = expandTo18Decimals( 1000 )
        await pairTransfer( expectedLiquidity.sub( MINIMUM_LIQUIDITY ) )
        await pairBurn( wallet.address )
        expect( await pairTotalSupply() )
            .to.eq( MINIMUM_LIQUIDITY )
    } )
    it( 'feeTo:on', async () => {
        await setFeeTo( other.address )

        const token0Amount = expandTo18Decimals( 1000 )
        const token1Amount = expandTo18Decimals( 1000 )
        await addLiquidity( token0Amount, token1Amount )

        const swapAmount = expandTo18Decimals( 1 )
        const expectedOutputAmount = BigNumber.from( '996006981039903216' )
        await token1Transfer( swapAmount )
        await swap( expectedOutputAmount, 0, wallet.address )

        const expectedLiquidity = expandTo18Decimals( 1000 )
        await pairTransfer( expectedLiquidity.sub( MINIMUM_LIQUIDITY ) )
        await pairBurn( wallet.address )
        expect( await pairTotalSupply() )
            .to.eq( MINIMUM_LIQUIDITY + BigInt( '249750499251388' ) )
        expect( await pairBalance( other.address ) )
            .to.eq( 249750499251388n )

        // using 1000 here instead of the symbolic MINIMUM_LIQUIDITY because the amounts only happen to be equal...
        // ...because the initial liquidity amounts were equal
        expect( await token0Balance( pairAddress() ) )
            .to.eq( 1000n +   249501683697445n )
        expect( await token1Balance( pairAddress() ) )
            .to.eq( 1000n + 250000187312969n )
    } )
} )
