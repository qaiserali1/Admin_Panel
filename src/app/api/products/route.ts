import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
};

// Handle OPTIONS preflight requests for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

// GET: Fetch all SKUs (CORS enabled for mobile app)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');
    const raw = searchParams.get('raw');

    const where: any = {};
    if (search) {
      where.OR = [
        { skuCode: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skus = await prisma.productSKU.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    if (raw === 'true') {
      return NextResponse.json(skus, { headers: corsHeaders });
    }

    return NextResponse.json(
      {
        success: true,
        count: skus.length,
        skus,
        products: skus,
      },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('Fetch SKUs Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch SKUs', details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}

// POST: Create a new SKU
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { skuCode, displayName } = body;

    if (!skuCode || !displayName) {
      return NextResponse.json(
        { success: false, error: 'skuCode and displayName are required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const trimmedCode = String(skuCode).trim();
    const trimmedName = String(displayName).trim();

    if (!trimmedCode || !trimmedName) {
      return NextResponse.json(
        { success: false, error: 'skuCode and displayName cannot be empty' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Check for duplicate skuCode
    const existing = await prisma.productSKU.findUnique({
      where: { skuCode: trimmedCode },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `SKU code "${trimmedCode}" already exists` },
        { status: 409, headers: corsHeaders }
      );
    }

    const newSku = await prisma.productSKU.create({
      data: {
        skuCode: trimmedCode,
        displayName: trimmedName,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Product SKU created successfully',
        sku: newSku,
      },
      { status: 201, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('Create SKU Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create SKU', details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}

// PUT: Update an existing SKU
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, skuCode, displayName } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'SKU ID is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Check if target SKU exists
    const existingSku = await prisma.productSKU.findUnique({
      where: { id },
    });

    if (!existingSku) {
      return NextResponse.json(
        { success: false, error: 'SKU not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    const updateData: any = {};

    if (skuCode !== undefined) {
      const trimmedCode = String(skuCode).trim();
      if (!trimmedCode) {
        return NextResponse.json(
          { success: false, error: 'skuCode cannot be empty' },
          { status: 400, headers: corsHeaders }
        );
      }

      // Check if another SKU has this skuCode
      const duplicate = await prisma.productSKU.findFirst({
        where: {
          skuCode: trimmedCode,
          NOT: { id },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { success: false, error: `SKU code "${trimmedCode}" is already in use by another product` },
          { status: 409, headers: corsHeaders }
        );
      }

      updateData.skuCode = trimmedCode;
    }

    if (displayName !== undefined) {
      const trimmedName = String(displayName).trim();
      if (!trimmedName) {
        return NextResponse.json(
          { success: false, error: 'displayName cannot be empty' },
          { status: 400, headers: corsHeaders }
        );
      }
      updateData.displayName = trimmedName;
    }

    const updatedSku = await prisma.productSKU.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Product SKU updated successfully',
        sku: updatedSku,
      },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('Update SKU Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update SKU', details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}

// DELETE: Remove an SKU
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let id = searchParams.get('id');

    if (!id) {
      const body = await req.json().catch(() => ({}));
      id = body?.id;
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'SKU ID is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const existingSku = await prisma.productSKU.findUnique({
      where: { id },
    });

    if (!existingSku) {
      return NextResponse.json(
        { success: false, error: 'SKU not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    await prisma.productSKU.delete({
      where: { id },
    });

    return NextResponse.json(
      {
        success: true,
        message: `SKU "${existingSku.skuCode}" deleted successfully`,
      },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('Delete SKU Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete SKU', details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
