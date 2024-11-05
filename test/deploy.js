const hre = require("hardhat");
// const { Pool, Position } = require('@uniswap/v3-sdk');
// const { Token, CurrencyAmount, Percent } = require('@uniswap/sdk-core');
var frontendUtil = require('@arcologynetwork/frontend-util/utils/util')

async function main() {
  
  accounts = await ethers.getSigners(); 


  console.log('===========start deploy token0 and token1=====================');
  const Arcology_factory = await ethers.getContractFactory("Arcology");
  const arcology = await Arcology_factory.deploy(1000);
  await arcology.deployed();
  console.log(`Deployed arcology at ${arcology.address}`);
  
  const decimals = await arcology.decimals();

  const Brcology_factory = await ethers.getContractFactory("Brcology");
  const brcology = await Brcology_factory.deploy(1000);
  await brcology.deployed();
  console.log(`Deployed brcology at ${brcology.address}`);

  const tokenA=brcology.address
  const tokenB=arcology.address;
  
  console.log('===========start UniswapV3Factory=====================')
  const UniswapV3Factory = await hre.ethers.getContractFactory("UniswapV3Factory");
  const swapfactory = await UniswapV3Factory.deploy();
  await swapfactory.deployed();
  console.log("UniswapV3Factory deployed to:", swapfactory.address);
  
  console.log('===========start create UniswapV3Pool=====================')
  const fee=3000;
  tx = await swapfactory.createPool(tokenA, tokenB, fee);
  receipt = await tx.wait();
  frontendUtil.showResult(frontendUtil.parseReceipt(receipt));
  const PoolCreatedDate=frontendUtil.parseEvent(receipt,"PoolCreated");
  const strlen=PoolCreatedDate.length;
  const poolAddress='0x'+PoolCreatedDate.substring(strlen-40,strlen);
  console.log("UniswapV3Pool created at:", poolAddress);

  
  console.log('===========start initialize UniswapV3Pool=====================')
  const sqrtPriceX96 = ethers.BigNumber.from("79228162514264337593543950336");     //1:1  
  const pool = await ethers.getContractAt("UniswapV3Pool", poolAddress);
  tx = await pool.initialize(sqrtPriceX96);
  receipt = await tx.wait();
  frontendUtil.showResult(frontendUtil.parseReceipt(receipt));
  console.log("Pool initialized with sqrtPriceX96:", sqrtPriceX96.toString());

  
  console.log('===========start deploy WETH9=====================');
  const weth9_factory = await ethers.getContractFactory("WETH9");
  const weth9 = await weth9_factory.deploy();
  await weth9.deployed();
  console.log(`Deployed WETH9 at ${weth9.address}`);
  const weth9addr=weth9.address

  console.log('===========start deploy NFTDescriptor=====================');
  const Lib = await ethers.getContractFactory("NFTDescriptor");
  const lib = await Lib.deploy();
  await lib.deployed();
  console.log(`Deployed NFTDescriptor at ${lib.address}`);

  console.log('===========start deploy NonfungibleTokenPositionDescriptor=====================');
  const nativeCurrencyLabelBytes = ethers.utils.formatBytes32String("ACL");
  const NonfungibleTokenPositionDescriptor_factory = await hre.ethers.getContractFactory("NonfungibleTokenPositionDescriptor", {
    signer: accounts[0],
    libraries: {
      NFTDescriptor: lib.address,
    },
  });
  const nonfungibleTokenPositionDescriptor = await NonfungibleTokenPositionDescriptor_factory.deploy(
    weth9.address,
    nativeCurrencyLabelBytes
  );
  await nonfungibleTokenPositionDescriptor.deployed();
  console.log("nonfungibleTokenPositionDescriptor deployed to:", nonfungibleTokenPositionDescriptor.address);


  console.log('===========start deploy NonfungiblePositionManager=====================');
  const NonfungiblePositionManager_factory = await hre.ethers.getContractFactory("NonfungiblePositionManager");
  const nonfungiblePositionManager = await NonfungiblePositionManager_factory.deploy(
    swapfactory.address,   
    weth9.address,
    nonfungibleTokenPositionDescriptor.address               
  );
  await nonfungiblePositionManager.deployed();
  console.log("NonfungiblePositionManager deployed to:", nonfungiblePositionManager.address);

  console.log('===========start deploy SwapRouter=====================');
  const router_factory = await hre.ethers.getContractFactory("SwapRouter");
  const router = await router_factory.deploy(
    swapfactory.address,   
    weth9.address            
  );
  await router.deployed();
  console.log("SwapRouter deployed to:", router.address);

  console.log('===========start deploy Quoter=====================');
  const quoter_factory = await hre.ethers.getContractFactory("Quoter");
  const quoter = await quoter_factory.deploy(
    swapfactory.address,   
    weth9.address            
  );
  await quoter.deployed();
  console.log("Quoter deployed to:", quoter.address);

  console.log('===========start deploy TickLens=====================');
  const TickLens_factory = await hre.ethers.getContractFactory("TickLens");
  const tickLens = await TickLens_factory.deploy();
  await tickLens.deployed();
  console.log("tickLens deployed to:", tickLens.address);
   

  await addLiquidity(nonfungiblePositionManager,arcology,brcology,tokenA,tokenB,fee,"1","1",accounts[0].address);

  console.log('===========transfer tokenA to account1=====================')
  const amountIn="0.5";
  tx = await arcology.transfer(accounts[1].address,ethers.utils.parseUnits(amountIn, 18));
  receipt=await tx.wait();
  frontendUtil.showResult(frontendUtil.parseReceipt(receipt));

  let balance = await arcology.balanceOf(accounts[1].address);
  let formattedBalance = ethers.utils.formatUnits(balance, decimals);
  console.log(`Balance of account ${accounts[1].address}: ${formattedBalance} tokens B`);

  balance = await brcology.balanceOf(accounts[1].address);
  formattedBalance = ethers.utils.formatUnits(balance, decimals);
  console.log(`Balance of account ${accounts[1].address}: ${formattedBalance} tokens A`);

  await swap(router,arcology,tokenA,tokenB,fee,amountIn,accounts[1]);

  balance = await arcology.balanceOf(accounts[1].address);
  formattedBalance = ethers.utils.formatUnits(balance, decimals);
  console.log(`Balance of account ${accounts[1].address}: ${formattedBalance} tokens B`);

  balance = await brcology.balanceOf(accounts[1].address);
  formattedBalance = ethers.utils.formatUnits(balance, decimals);
  console.log(`Balance of account ${accounts[1].address}: ${formattedBalance} tokens A`);
}

async function swap(swapRouter,arcology,tokenA,tokenB,fee, amountIn,recipient) {
  console.log('===========approve token=====================')
  let tx = await arcology.connect(recipient).approve(swapRouter.address,ethers.utils.parseUnits(amountIn, 18));
  let receipt=await tx.wait();
  frontendUtil.showResult(frontendUtil.parseReceipt(receipt));

  console.log('===========swap token=====================')
  const params = {
      tokenIn: tokenB,                
      tokenOut: tokenA,               
      fee: fee,                            
      recipient: recipient.address,                    
      deadline: Math.floor(Date.now() / 1000) + 60 * 10, 
      amountIn: ethers.utils.parseUnits(amountIn, 18), 
      amountOutMinimum: 0,                     
      sqrtPriceLimitX96: 0                     
  };
  
  tx = await swapRouter.connect(recipient).exactInputSingle(params, {
      gasLimit: 500000000 
  });

  receipt=await tx.wait();
  console.log("Swap successfully!");
}

async function addLiquidity(nonfungiblePositionManager,arcology,brcology,tokenA,tokenB,fee, amountA, amountB,recipient) {
  console.log('===========approve token=====================')
  let tx = await arcology.approve(nonfungiblePositionManager.address,ethers.utils.parseUnits(amountA, 18));
  let receipt=await tx.wait();
  frontendUtil.showResult(frontendUtil.parseReceipt(receipt));
  
  tx = await brcology.approve(nonfungiblePositionManager.address,ethers.utils.parseUnits(amountB, 18));
  receipt=await tx.wait();
  frontendUtil.showResult(frontendUtil.parseReceipt(receipt));

  console.log('===========addLiquidity token=====================')
  const params = {
    token0: tokenA,
    token1: tokenB,
    fee: fee, 
    tickLower: -600,
    tickUpper: 600,
    amount0Desired: ethers.utils.parseUnits(amountA, 18), 
    amount1Desired: ethers.utils.parseUnits(amountB, 18),
    amount0Min: 0,
    amount1Min: 0,
    recipient: recipient, 
    deadline: Math.floor(Date.now() / 1000) + 60 * 20,
  };

  tx = await nonfungiblePositionManager.mint(params, {
    gasLimit: 500000000,
  });

  receipt=await tx.wait();
  console.log("Liquidity added successfully!");
}

function getPrice(percent){
  return Math.sqrt(4)*Math.pow(2,96);
}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
