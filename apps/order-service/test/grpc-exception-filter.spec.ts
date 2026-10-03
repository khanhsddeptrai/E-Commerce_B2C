import { ArgumentsHost } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { firstValueFrom } from 'rxjs';
import { GrpcExceptionFilter } from '../src/common/rpc-exception.filter';

describe('GrpcExceptionFilter – giữ đúng mã lỗi gRPC', () => {
  const filter = new GrpcExceptionFilter();
  const host = {} as ArgumentsHost;

  const errorOf = async (exception: unknown) => {
    try {
      await firstValueFrom(filter.catch(exception, host));
    } catch (err: unknown) {
      return err;
    }
    throw new Error('filter không trả lỗi');
  };

  it('RpcException: giữ nguyên mã và thông báo (vd hết hàng → RESOURCE_EXHAUSTED)', async () => {
    const err = await errorOf(new RpcException({ code: status.RESOURCE_EXHAUSTED, message: 'Sản phẩm không đủ số lượng tồn kho' }));

    expect(err).toEqual({ code: status.RESOURCE_EXHAUSTED, message: 'Sản phẩm không đủ số lượng tồn kho' });
  });

  it('RpcException từ một bản cài @nestjs/microservices khác (instanceof sai): vẫn nhận diện được', async () => {
    // Mô phỏng object RpcException của bản cài khác: cùng hình dạng nhưng không cùng class
    class ForeignRpcException extends Error {
      constructor(private readonly payload: object) {
        super('foreign');
      }
      getError() {
        return this.payload;
      }
    }
    const foreign = new ForeignRpcException({ code: status.NOT_FOUND, message: 'Không tìm thấy đơn hàng' });

    expect(foreign).not.toBeInstanceOf(RpcException);
    expect(await errorOf(foreign)).toEqual({ code: status.NOT_FOUND, message: 'Không tìm thấy đơn hàng' });
  });

  it('lỗi không mong đợi: trả INTERNAL với thông báo chung, không lộ chi tiết nội bộ', async () => {
    const err = await errorOf(new Error('connection string postgres://user:pass@...'));

    expect(err).toEqual({ code: status.INTERNAL, message: 'Lỗi hệ thống nội bộ' });
  });
});
